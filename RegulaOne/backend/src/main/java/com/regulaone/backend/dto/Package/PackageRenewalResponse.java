package com.regulaone.backend.dto.Package;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Response for POST /api/superadmin/tenants/{tenantId}/package/renew.
 *
 * Summarises the outcome of a renewal so the frontend can confirm the new
 * validity window and show the invoice that was generated.
 *
 * planExpiring is the NEW expiry after renewal.
 * invoiceNumber/amount/currency describe the invoice created for this renewal.
 */
@Data
@Builder
public class PackageRenewalResponse {

    // The tenant whose plan was renewed.
    private String tenantId;
    private String tenantName;

    // The package tier that was renewed (unchanged by a renewal).
    private String packageName;

    // The new active validity window after renewal.
    private LocalDateTime planStarted;

    // Null for LIFETIME plans (which never expire and are not renewable this way).
    private LocalDateTime planExpiring;

    // The invoice generated for this renewal.
    private String invoiceNumber;
    private BigDecimal amount;
    private String currency;

    // The reason recorded on the history entry (default when none supplied).
    private String reason;
}
