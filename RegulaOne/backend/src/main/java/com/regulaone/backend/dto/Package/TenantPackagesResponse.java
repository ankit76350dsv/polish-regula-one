package com.regulaone.backend.dto.Package;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * Response DTO for the "get packages for tenant" endpoint.
 *
 * Returns the tenant's currently active package and the full history of
 * previously assigned packages — both derived from @DBRef fields on Tenant,
 * not from a separate junction collection.
 */
@Data
@Builder
public class TenantPackagesResponse {

    private String tenantId;

    // The package currently active for this tenant (null if none assigned)
    private PackageResponse currentPackage;

    // All previously assigned packages, in chronological order
    private List<PackageResponse> packageHistory;
}
