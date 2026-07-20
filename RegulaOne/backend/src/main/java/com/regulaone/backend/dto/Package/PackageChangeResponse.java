package com.regulaone.backend.dto.Package;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Response for POST /api/superadmin/tenants/{tenantId}/package/upgrade.
 *
 * Summarises a plan change so the frontend can confirm which tier the tenant
 * moved from/to, the new validity window, and the invoice generated.
 *
 * fromPackage is null if the tenant had no package before the change.
 * planExpiring is null for LIFETIME plans.
 */
@Data
@Builder
public class PackageChangeResponse {

    private String tenantId;
    private String tenantName;

    // The previous tier (null if none) and the new tier after the change.
    private String fromPackage;
    private String toPackage;

    // The new active validity window.
    private LocalDateTime planStarted;
    private LocalDateTime planExpiring;

    // The invoice generated for the change.
    private String invoiceNumber;
    private BigDecimal amount;
    private String currency;

    // The reason recorded on the history entry (default when none supplied).
    private String reason;
}
