package com.regulaone.backend.dto.Tenant;

import com.regulaone.backend.dto.Package.PackageResponse;
import com.regulaone.backend.models.Tenant;
import com.regulaone.backend.models.TenantStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Read-only DTO returned by all Tenant API responses.
 *
 * enabledModules has been removed — app access is now derived from
 * currentPackage.appIds at query time, not stored on the tenant.
 *
 * currentPackage and packageHistory are embedded as full PackageResponse objects
 * so callers get all package details in a single API response.
 */
@Data
@Builder
public class TenantResponse {

    private String id;
    private String name;
    private String nip;
    private String regon;
    private String email;
    private String phone;
    private String address;
    private String city;
    private String postalCode;
    private TenantStatus status;

    // OLD: enabledModules removed — app access now comes from currentPackage
    // private List<TenantModule> enabledModules;

    // The package currently active for this tenant (null if none assigned)
    private PackageResponse currentPackage;

    // All previously assigned packages, in chronological order
    private List<PackageResponse> packageHistory;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static TenantResponse from(Tenant tenant) {
        // Map currentPackage @DBRef to PackageResponse (null-safe)
        PackageResponse currentPkg = tenant.getCurrentPackage() != null
                ? PackageResponse.from(tenant.getCurrentPackage())
                : null;

        // Map packageHistory @DBRef list to PackageResponse list
        List<PackageResponse> history = tenant.getPackageHistory() != null
                ? tenant.getPackageHistory().stream()
                        .map(PackageResponse::from)
                        .collect(Collectors.toList())
                : List.of();

        return TenantResponse.builder()
                .id(tenant.getId())
                .name(tenant.getName())
                .nip(tenant.getNip())
                .regon(tenant.getRegon())
                .email(tenant.getEmail())
                .phone(tenant.getPhone())
                .address(tenant.getAddress())
                .city(tenant.getCity())
                .postalCode(tenant.getPostalCode())
                .status(tenant.getStatus())
                .currentPackage(currentPkg)
                .packageHistory(history)
                .createdAt(tenant.getCreatedAt())
                .updatedAt(tenant.getUpdatedAt())
                .build();
    }
}
