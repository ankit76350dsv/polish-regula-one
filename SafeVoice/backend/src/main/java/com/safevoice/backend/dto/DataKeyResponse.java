package com.safevoice.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Answer to "please give me a one-time key to lock a report".
 *
 * The browser uses {@code plaintextKey} once to lock (encrypt) the text, then forgets it, and
 * sends back the ciphertext together with {@code wrappedKey}. Only the wrapped key is ever
 * stored — on its own it cannot unlock anything without AWS KMS.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DataKeyResponse {

    // The plain key, base64. USE ONCE in the browser, then throw away. Never stored on the server.
    private String plaintextKey;

    // The same key, locked by the KMS master key, base64. Safe to store with the ciphertext.
    private String wrappedKey;

    // Which KMS master key made this data key (for records/audit). Not a secret.
    private String kmsKeyId;

    // A hint to the browser on how to lock the data (we use AES-256-GCM).
    private String algorithm;
}
