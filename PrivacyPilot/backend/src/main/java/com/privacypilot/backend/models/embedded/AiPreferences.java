package com.privacypilot.backend.model.embedded;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Per-company settings for the optional AI assistant.
 *
 * Privacy safety: when {@code excludeSpecialCategories} is true, the app must
 * never send Article 9 special-category data (health, religion, etc.) or
 * whistleblowing data to the AI. This is a data-minimisation guard so the most
 * sensitive data never leaves the system through the AI feature.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AiPreferences {

    // Master on/off switch for the AI assistant for this company.
    private boolean enabled = true;

    // When true, never send special-category or whistleblowing data to the AI.
    private boolean excludeSpecialCategories = true;
}
