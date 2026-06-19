package com.safevoice.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Local implementation of EncryptionService that derives tenant-specific keys
 * locally from a master key using HMAC-SHA256, then performs AES-256-GCM encryption.
 * Used for development and testing.
 */
@Service
public class LocalEncryptionServiceImpl implements EncryptionService {

    private final byte[] masterKeyBytes;
    private final SecureRandom secureRandom = new SecureRandom();

    public LocalEncryptionServiceImpl(
            @Value("${safevoice.encryption.local-master-key:default-master-key-must-change-in-prod-1234567890}") String masterKeyString) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            this.masterKeyBytes = digest.digest(masterKeyString.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new RuntimeException("Failed to initialize local master key", e);
        }
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
            byte[] tenantKey = deriveTenantKey(tenantId);
            SecretKeySpec keySpec = new SecretKeySpec(tenantKey, "AES");

            byte[] iv = new byte[12];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            GCMParameterSpec spec = new GCMParameterSpec(128, iv);
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, spec);

            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            byte[] combined = new byte[iv.length + ciphertext.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(ciphertext, 0, combined, iv.length, ciphertext.length);

            return Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            throw new RuntimeException("Encryption failed", e);
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

            byte[] tenantKey = deriveTenantKey(tenantId);
            SecretKeySpec keySpec = new SecretKeySpec(tenantKey, "AES");

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            GCMParameterSpec spec = new GCMParameterSpec(128, iv);
            cipher.init(Cipher.DECRYPT_MODE, keySpec, spec);

            byte[] decrypted = cipher.doFinal(ciphertextBytes);
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("Decryption failed", e);
        }
    }

    private byte[] deriveTenantKey(String tenantId) {
        try {
            Mac sha256HMAC = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(masterKeyBytes, "HmacSHA256");
            sha256HMAC.init(secretKey);
            return sha256HMAC.doFinal(tenantId.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new RuntimeException("Failed to derive tenant key", e);
        }
    }
}
