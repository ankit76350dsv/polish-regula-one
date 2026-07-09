package com.safevoice.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * A block of text that the BROWSER already locked (encrypted) before sending it to us.
 *
 * The server stores these three parts as-is and can read NONE of them:
 *   - ciphertext: the locked text (base64)
 *   - iv:         the small random "starter value" AES-GCM needs to unlock later (base64)
 *   - wrappedKey: the one-time data key, itself locked by AWS KMS (base64)
 *
 * Sizes are capped so a caller cannot push a giant blob at us. ~2 MB of base64 comfortably
 * covers a long written report; the wrapped key and iv are tiny.
 */
@Data
public class EncryptedPayloadDto {

    @NotBlank(message = "Encrypted content is required")
    @Size(max = 2_000_000, message = "Encrypted content is too large")
    private String ciphertext;

    @NotBlank(message = "Encryption IV is required")
    @Size(max = 256, message = "IV is too long")
    private String iv;

    @NotBlank(message = "Wrapped key is required")
    @Size(max = 2048, message = "Wrapped key is too long")
    private String wrappedKey;

    // Optional label of how it was locked (e.g. "AES-256-GCM"). Informational only.
    @Size(max = 32, message = "Algorithm label is too long")
    private String algorithm;
}
