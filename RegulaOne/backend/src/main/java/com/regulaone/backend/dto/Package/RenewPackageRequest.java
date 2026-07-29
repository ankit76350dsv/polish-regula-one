package com.regulaone.backend.dto.Package;

import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Request body for POST /api/superadmin/tenants/{tenantId}/package/renew.
 *
 * Renewal keeps the tenant on its CURRENT package tier and extends the validity
 * window by another billing period. The body is optional — the only field is a
 * free-text reason recorded in the tenant's package history (audit trail), the
 * same way a plan change records why the admin acted.
 *
 * reason is nullable; when omitted the service records a default ("Package renewal").
 */
@Data
public class RenewPackageRequest {

    // Optional human-readable reason for the renewal, stored on the history entry.
    // Capped to keep the audit log tidy and avoid oversized documents.
    @Size(max = 500, message = "reason must be 500 characters or fewer")
    private String reason;
}
