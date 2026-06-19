package com.safevoice.backend.service;

/**
 * Interface representing standard client-side field-level encryption/decryption.
 */
public interface EncryptionService {

    /**
     * Encrypts the plaintext string using a tenant-specific key.
     *
     * @param plaintext The plain string to encrypt.
     * @param tenantId  The ID of the tenant.
     * @return Base64-encoded encrypted string.
     */
    String encrypt(String plaintext, String tenantId);

    /**
     * Decrypts the Base64 ciphertext using a tenant-specific key.
     *
     * @param ciphertext The Base64 encrypted string.
     * @param tenantId   The ID of the tenant.
     * @return Decrypted plaintext string.
     */
    String decrypt(String ciphertext, String tenantId);
}
