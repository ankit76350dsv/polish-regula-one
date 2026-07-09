package com.safevoice.backend.model.embedded;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * How locked (encrypted) text is stored inside a case or a message in the database.
 *
 * This is what a database thief would see instead of the real words: three meaningless-looking
 * strings. Without AWS KMS (to unwrap the key) and the user's browser (to unlock the text),
 * none of this can be read. That is the whole point — the database on its own is useless.
 *
 *   - ciphertext: the locked text (base64)
 *   - iv:         the small random starter value AES-GCM needs to unlock (base64)
 *   - wrappedKey: the one-time data key, itself locked by the KMS master key (base64)
 *   - algorithm:  how it was locked, e.g. "AES-256-GCM" (informational)
 *   - kmsKeyId:   which KMS master key wrapped the data key (for records/audit; not a secret)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EncryptedPayload {

    private String ciphertext;

    private String iv;

    private String wrappedKey;

    private String algorithm;

    private String kmsKeyId;

    /**
     * Build a payload from the three parts a browser sends on a multipart message form, or return
     * null when the message carries no locked text (for example a files-only message). All three
     * core parts must be present together; a half-filled payload is treated as "no encryption".
     */
    public static EncryptedPayload fromParts(String ciphertext, String iv, String wrappedKey, String algorithm) {
        boolean complete = ciphertext != null && !ciphertext.isBlank()
                && iv != null && !iv.isBlank()
                && wrappedKey != null && !wrappedKey.isBlank();
        if (!complete) {
            return null;
        }
        String algo = (algorithm == null || algorithm.isBlank()) ? "AES-256-GCM" : algorithm;
        return new EncryptedPayload(ciphertext, iv, wrappedKey, algo, null);
    }
}
