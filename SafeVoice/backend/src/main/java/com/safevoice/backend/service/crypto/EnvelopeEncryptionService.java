package com.safevoice.backend.service.crypto;

import com.safevoice.backend.dto.DataKeyResponse;
import com.safevoice.backend.exception.CryptoOperationException;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.kms.KmsClient;
import software.amazon.awssdk.services.kms.model.DataKeySpec;
import software.amazon.awssdk.services.kms.model.DecryptRequest;
import software.amazon.awssdk.services.kms.model.DecryptResponse;
import software.amazon.awssdk.services.kms.model.GenerateDataKeyRequest;
import software.amazon.awssdk.services.kms.model.GenerateDataKeyResponse;

import java.util.Base64;
import java.util.Map;

/**
 * The heart of SafeVoice "envelope encryption" done the SAFE way for a SaaS.
 *
 * WHY THIS EXISTS (in very simple words):
 *   - We want report text to be locked so that our database, by itself, is useless to a thief.
 *   - The learning demo locked data in the browser but kept the AWS password IN the browser.
 *     That is dangerous: anyone could open the browser tools, steal the password, and unlock
 *     everything. So we do NOT do that.
 *   - Instead, ONLY this server talks to AWS KMS. The browser never sees an AWS password.
 *
 * HOW ENVELOPE ENCRYPTION WORKS HERE:
 *   1) To LOCK a report, the browser asks this server for a brand-new "data key".
 *      We ask AWS KMS to make one. KMS gives us the key TWICE:
 *        - a plain copy (used once, right away, to lock the text), and
 *        - a "wrapped" (locked) copy that is safe to store next to the ciphertext.
 *      The browser locks the text with the plain copy, throws the plain copy away, and sends
 *      us the ciphertext + the wrapped copy. We store both. We never see the plain text.
 *   2) To UNLOCK later, the browser sends the wrapped copy back. We ask KMS to unwrap it and
 *      hand the plain data key to the browser, which unlocks the text on the user's device.
 *
 * TENANT ISOLATION (very important for a multi-company SaaS):
 *   Every data key is tied to ONE organisation using a KMS "encryption context" that includes
 *   the tenant id. KMS refuses to unwrap a key unless the SAME context is given again. So a
 *   wrapped key stolen from Company A can never be unwrapped as Company B — the maths won't
 *   allow it. This gives cryptographic separation even if a single master key is shared.
 *
 * SAFETY RULES FOLLOWED HERE:
 *   - We NEVER log a plain data key or any report text.
 *   - The AWS master key stays inside AWS; we only move tiny data keys.
 *   - Any AWS failure is wrapped in a neutral error (no AWS internals leak out).
 */
@Slf4j
@Service
public class EnvelopeEncryptionService {

    // Fixed label put into the encryption context so a key made for SafeVoice reports can only
    // ever be unwrapped for SafeVoice reports (extra binding on top of the tenant id).
    private static final String PURPOSE = "safevoice-report";

    private final KmsClient kmsClient;

    // The KMS master key (its id, ARN, or alias) that wraps our data keys. Comes from config /
    // environment — never hardcoded. Must live in the configured EEA region (see KmsConfig).
    private final String masterKeyId;

    public EnvelopeEncryptionService(KmsClient kmsClient,
                                     @Value("${safevoice.kms.key-id:}") String masterKeyId) {
        this.kmsClient = kmsClient;
        this.masterKeyId = masterKeyId;
    }

    /**
     * Make a fresh, one-time AES-256 data key for a given organisation.
     *
     * Returns BOTH forms of the key:
     *   - plaintextKey: the plain key, base64 text. The browser uses it once to lock the report
     *     and then throws it away. It is NEVER stored on the server or in the database.
     *   - wrappedKey: the same key, locked by the KMS master key, base64 text. This is safe to
     *     store next to the ciphertext; on its own it cannot unlock anything without KMS.
     *
     * @param tenantId the organisation the key is for (goes into the encryption context)
     */
    public DataKeyResponse generateDataKey(String tenantId) {
        requireKeyConfigured();
        if (tenantId == null || tenantId.isBlank()) {
            throw new IllegalArgumentException("Tenant id is required to make a data key");
        }
        try {
            GenerateDataKeyRequest request = GenerateDataKeyRequest.builder()
                    .keyId(masterKeyId) // "arn:aws:kms:eu-central-1:258963147938:key/key-id"
                    .keySpec(DataKeySpec.AES_256) // 256-bit key => AES-256 in the browser
                    .encryptionContext(contextFor(tenantId))
                    .build(); 
            // request
            //  {
            //   "KeyId": "arn:aws:kms:eu-central-1:258963147938:key/key-id",
            //   "KeySpec": "AES_256",
            //   "EncryptionContext": {
            //     "tenantId": "tenant-1234",
            //     "purpose": "safevoice-report"
            //   }
            // }

            GenerateDataKeyResponse response = kmsClient.generateDataKey(request);

            // Base64 so the raw bytes travel safely as JSON text over TLS.
            String plaintextKey = Base64.getEncoder().encodeToString(response.plaintext().asByteArray());
            String wrappedKey = Base64.getEncoder().encodeToString(response.ciphertextBlob().asByteArray());

            // NOTE: we deliberately log NOTHING about the key values themselves.
            return DataKeyResponse.builder()
                    .plaintextKey(plaintextKey)
                    .wrappedKey(wrappedKey)
                    .kmsKeyId(response.keyId())
                    .algorithm("AES-256-GCM")
                    .build();
        } catch (RuntimeException e) {
            log.error("[EnvelopeEncryptionService] KMS generateDataKey failed (detail hidden).");
            throw new CryptoOperationException("Encryption service is temporarily unavailable.", e);
        }
    }

    /**
     * Unwrap (unlock) a stored wrapped data key so the browser can decrypt on the user's device.
     *
     * The SAME tenant id must be supplied as when the key was made — otherwise KMS refuses,
     * which is exactly what keeps one organisation from unlocking another's data.
     *
     * @param tenantId     the organisation that owns the key (must match how it was made)
     * @param wrappedKeyB64 the base64 wrapped key that was stored with the ciphertext
     * @return the plain data key as base64 text (handed to the browser over TLS, never stored)
     */
    public String unwrapDataKey(String tenantId, String wrappedKeyB64) {
        requireKeyConfigured();
        if (tenantId == null || tenantId.isBlank()) {
            throw new IllegalArgumentException("Tenant id is required to unwrap a data key");
        }
        if (wrappedKeyB64 == null || wrappedKeyB64.isBlank()) {
            throw new IllegalArgumentException("Wrapped key is required");
        }
        try {
            byte[] wrappedBytes = Base64.getDecoder().decode(wrappedKeyB64);

            DecryptRequest request = DecryptRequest.builder()
                    .keyId(masterKeyId) // name the expected key so only it can be used
                    .ciphertextBlob(SdkBytes.fromByteArray(wrappedBytes))
                    .encryptionContext(contextFor(tenantId)) // must match the make-time context
                    .build();

            DecryptResponse response = kmsClient.decrypt(request);
            return Base64.getEncoder().encodeToString(response.plaintext().asByteArray());
        } catch (IllegalArgumentException e) {
            // Bad base64 etc. — a client input problem, surfaced as a plain 400 by the handler.
            throw e;
        } catch (RuntimeException e) {
            log.error("[EnvelopeEncryptionService] KMS decrypt failed (detail hidden).");
            throw new CryptoOperationException("Decryption service is temporarily unavailable.", e);
        }
    }

    /** True when a master key is configured, so callers can fall back cleanly in local dev. */
    public boolean isConfigured() {
        return masterKeyId != null && !masterKeyId.isBlank();
    }

    // Build the encryption context: the exact same map must be used to make AND to unwrap a key.
    private Map<String, String> contextFor(String tenantId) {
        return Map.of("tenantId", tenantId, "purpose", PURPOSE);
    }

    // Stop early with a clear message if nobody set a KMS key. This prevents confusing AWS errors
    // and makes it obvious that the environment is missing its SAFEVOICE_KMS_KEY_ID.
    private void requireKeyConfigured() {
        if (!isConfigured()) {
            throw new CryptoOperationException(
                    "Encryption is not configured (no KMS key set).",
                    new IllegalStateException("safevoice.kms.key-id is blank"));
        }
    }
}
