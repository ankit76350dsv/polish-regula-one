package com.safevoice.backend.service;

import com.safevoice.backend.model.document.TenantKey;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.kms.KmsClient;
import software.amazon.awssdk.services.kms.model.*;

import jakarta.annotation.PostConstruct;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * AWS KMS implementation of EncryptionService.
 * Enforces client-side envelope encryption:
 * 1. Generates and decrypts tenant-specific data keys using AWS KMS.
 * 2. Caches plaintext data keys in memory.
 * 3. Stores encrypted data keys in MongoDB.
 * 4. Performs AES-256-GCM encryption/decryption client-side.
 */
@Service
public class AwsKmsEncryptionServiceImpl implements EncryptionService {

    private final MongoTemplate mongoTemplate;
    private final String kmsKeyId;
    private final String region;
    private final Map<String, SecretKeySpec> dataKeyCache = new ConcurrentHashMap<>();
    private final SecureRandom secureRandom = new SecureRandom();
    private KmsClient kmsClient;

    @Autowired
    public AwsKmsEncryptionServiceImpl(
            MongoTemplate mongoTemplate,
            @Value("${safevoice.encryption.aws.kms-key-id}") String kmsKeyId,
            @Value("${safevoice.encryption.aws.region:eu-central-1}") String region) {
        this.mongoTemplate = mongoTemplate;
        this.kmsKeyId = kmsKeyId;
        this.region = region;
    }

    @PostConstruct
    public void init() {
        this.kmsClient = KmsClient.builder()
                .region(Region.of(region))
                .build();
    }

    @Override
    public String encrypt(String plaintext, String tenantId) {
        if (plaintext == null) {
            return null;
        }
        if (tenantId == null || tenantId.trim().isEmpty()) {
            throw new IllegalArgumentException("Tenant ID cannot be null or empty for encryption");
        }
        try {
            SecretKeySpec tenantKey = getOrCreateTenantKey(tenantId);

            byte[] iv = new byte[12];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            GCMParameterSpec spec = new GCMParameterSpec(128, iv);
            cipher.init(Cipher.ENCRYPT_MODE, tenantKey, spec);

            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            byte[] combined = new byte[iv.length + ciphertext.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(ciphertext, 0, combined, iv.length, ciphertext.length);

            return Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            throw new RuntimeException("Envelope encryption failed for tenant: " + tenantId, e);
        }
    }

    @Override
    public String decrypt(String ciphertext, String tenantId) {
        if (ciphertext == null) {
            return null;
        }
        if (tenantId == null || tenantId.trim().isEmpty()) {
            throw new IllegalArgumentException("Tenant ID cannot be null or empty for decryption");
        }
        try {
            byte[] combined = Base64.getDecoder().decode(ciphertext);
            if (combined.length < 12) {
                throw new IllegalArgumentException("Invalid ciphertext length");
            }

            byte[] iv = new byte[12];
            System.arraycopy(combined, 0, iv, 0, 12);

            byte[] ciphertextBytes = new byte[combined.length - 12];
            System.arraycopy(combined, 12, ciphertextBytes, 0, ciphertextBytes.length);

            SecretKeySpec tenantKey = getOrCreateTenantKey(tenantId);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            GCMParameterSpec spec = new GCMParameterSpec(128, iv);
            cipher.init(Cipher.DECRYPT_MODE, tenantKey, spec);

            byte[] decrypted = cipher.doFinal(ciphertextBytes);
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("Envelope decryption failed for tenant: " + tenantId, e);
        }
    }

    private SecretKeySpec getOrCreateTenantKey(String tenantId) {
        return dataKeyCache.computeIfAbsent(tenantId, id -> {
            TenantKey tenantKey = mongoTemplate.findById(id, TenantKey.class);
            if (tenantKey != null) {
                // Decrypt existing data key using AWS KMS
                byte[] encryptedKeyBytes = Base64.getDecoder().decode(tenantKey.getEncryptedDataKeyBase64());
                DecryptRequest decryptRequest = DecryptRequest.builder()
                        .ciphertextBlob(SdkBytes.fromByteArray(encryptedKeyBytes))
                        .build();
                DecryptResponse decryptResponse = kmsClient.decrypt(decryptRequest);
                byte[] plaintextKey = decryptResponse.plaintext().asByteArray();
                return new SecretKeySpec(plaintextKey, "AES");
            } else {
                // Generate a new data key using AWS KMS
                GenerateDataKeyRequest generateRequest = GenerateDataKeyRequest.builder()
                        .keyId(kmsKeyId)
                        .keySpec(DataKeySpec.AES_256)
                        .build();
                GenerateDataKeyResponse generateResponse = kmsClient.generateDataKey(generateRequest);
                byte[] plaintextKey = generateResponse.plaintext().asByteArray();
                byte[] encryptedKey = generateResponse.ciphertextBlob().asByteArray();

                // Store encrypted key to MongoDB
                TenantKey tk = new TenantKey(id, Base64.getEncoder().encodeToString(encryptedKey));
                mongoTemplate.save(tk);

                return new SecretKeySpec(plaintextKey, "AES");
            }
        });
    }
}
