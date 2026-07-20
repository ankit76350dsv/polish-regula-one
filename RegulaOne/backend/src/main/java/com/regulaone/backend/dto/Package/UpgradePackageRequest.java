package com.regulaone.backend.dto.Package;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Request body for POST /api/superadmin/tenants/{tenantId}/package/upgrade.
 *
 * Moves a tenant to a DIFFERENT package tier (upgrade or downgrade). The new
 * plan starts now with a fresh validity window; the outgoing plan is archived
 * into the tenant's package history.
 *
 * packageId is required — the catalogue AppPackage to switch to.
 * reason is optional and recorded on the history entry (audit trail).
 *
 * To EXTEND the same tier instead of switching, use the renew endpoint.
 */
@Data
public class UpgradePackageRequest {

    // The AppPackage id (from the packages catalogue) to switch the tenant to.
    @NotBlank(message = "packageId is required")
    private String packageId;

    // Optional human-readable reason for the change, stored on the history entry.
    @Size(max = 500, message = "reason must be 500 characters or fewer")
    private String reason;
}
