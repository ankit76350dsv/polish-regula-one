package com.ksefflow.backend.dto.ksefapi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * KSeF 2.0 — session encryption material sent when opening an online session.
 *
 * {@code encryptedSymmetricKey} = Base64( RSA-OAEP(SHA-256)( 32-byte AES key ) ) using the
 * Ministry of Finance public key. {@code initializationVector} = Base64( 16-byte AES IV ).
 * The same AES key/IV must then encrypt every invoice sent within the session.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record EncryptionInfo(
        String encryptedSymmetricKey,
        String initializationVector,
        String publicKeyId) {
}
