package com.privacypilot.backend.dto.dsar;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * The payload for the two DSAR actions that REQUIRE a written justification:
 *  - extend  → why the one-month deadline is being extended (Art. 12(3): only for
 *              complex/numerous requests, and the person must be told why);
 *  - refuse  → the lawful ground for declining (Art. 12(5)).
 *
 * The reason is mandatory in both cases (blank → 400).
 */
@Data
public class DsarReasonRequest {

    @NotBlank(message = "reason is required")
    private String reason;
}
