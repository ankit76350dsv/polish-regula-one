package com.ksefflow.backend.dto.ksefapi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

/**
 * KSeF 2.0 — one entry of {@code GET /security/public-key-certificates}.
 *
 * {@code certificate} is the Base64(DER) X.509 cert whose RSA public key is used to
 * wrap (RSA-OAEP, SHA-256) the AES session key for online-session invoice encryption.
 * Pick the entry whose {@code usage} contains {@code SymmetricKeyEncryption}.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PublicKeyCertificate(
        String certificate,
        String certificateId,
        String publicKeyId,
        String validFrom,
        String validTo,
        List<String> usage) {
}
