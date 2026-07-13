package com.safevoice.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.HashMap;
import java.util.Map;

/**
 * All the plain data keys a reader (the reporter, or authorised staff) needs to unlock ONE case
 * in their browser.
 *
 * We return the keys in ONE call so the browser can unlock the whole case (the main report plus
 * every message in the thread) without asking again and again. Each key here is a plain data key
 * (base64) that KMS just unwrapped for us; the browser uses it to unlock the matching ciphertext
 * and then throws it away. These keys are NEVER stored — they exist only for this one response.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CaseKeysResponse {
    // Plain data key for the main report text. Null when the report has no encrypted content
    // (for example an HR grievance, which is stored as plain text by law/policy).
    private String contentKey; //! plaintext (unlocked) KEY

    // Plain data key for each encrypted thread message, keyed by the message id.
    @Builder.Default
    private Map<String, String> messageKeys = new HashMap<>(); 
}
