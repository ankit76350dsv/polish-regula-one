package com.regulaone.backend.dto.Package;

import com.regulaone.backend.models.TenantPackage;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Response DTO returned when listing the packages assigned to a specific tenant.
 *
 * Combines assignment metadata (who assigned it, when) with the full
 * package details (PackageResponse) so callers don't need a second API call.
 */
@Data
@Builder
public class TenantPackageResponse {

    // The ID of the TenantPackage assignment record itself
    private String assignmentId;

    private String tenantId;
    private String packageId;

    // Cognito sub of the super admin who assigned the package
    private String assignedBy;

    private LocalDateTime assignedAt;

    // Full package details embedded to avoid N+1 lookups on the client
    private PackageResponse packageDetails;

    /**
     * Factory method — builds the response from the TenantPackage junction record
     * and the already-resolved PackageResponse.
     */
    public static TenantPackageResponse from(TenantPackage assignment, PackageResponse packageDetails) {
        return TenantPackageResponse.builder()
                .assignmentId(assignment.getId())
                .tenantId(assignment.getTenantId())
                .packageId(assignment.getPackageId())
                .assignedBy(assignment.getAssignedBy())
                .assignedAt(assignment.getAssignedAt())
                .packageDetails(packageDetails)
                .build();
    }
}
