package com.privacypilot.backend.dto.vendor;

import com.privacypilot.backend.model.enums.common.RiskLevel;
import com.privacypilot.backend.model.enums.vendor.DpaStatus;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * The payload for CREATING or UPDATING a processor (Art. 28 vendor).
 *
 * It carries only the fields a user fills in. The server owns id, tenantId, the
 * timestamps and the created/updated-by stamps. Enum fields accept the string codes
 * ("signed", "high", …); an unknown code is rejected as 400 by the enum's JsonCreator.
 * When dpaStatus / riskLevel are omitted the service applies sensible defaults
 * (MISSING / MEDIUM), mirroring the frontend's "new processor" form.
 */
@Data
public class VendorRequest {

    @NotBlank(message = "name is required")
    private String name;

    // Free text — the head-office country and the real data-hosting region.
    private String country;
    private String region;

    // Whether the Art. 28 Data Processing Agreement is in place. Defaults to MISSING.
    private DpaStatus dpaStatus;

    // Other suppliers this vendor uses under the hood (Art. 28(2)/(4)).
    private List<String> subprocessors = new ArrayList<>();

    // Overall risk rating for this supplier. Defaults to MEDIUM.
    private RiskLevel riskLevel;

    // When the processor was last reviewed (ISO-8601). Null = never reviewed.
    private Instant lastReviewAt;
}
