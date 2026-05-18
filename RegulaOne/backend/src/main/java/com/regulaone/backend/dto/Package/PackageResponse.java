package com.regulaone.backend.dto.Package;

import com.regulaone.backend.models.AppPackage;
import com.regulaone.backend.models.DurationType;
import com.regulaone.backend.models.PackageStatus;
import com.regulaone.backend.models.Tenant;
import com.regulaone.backend.models.TenantModule;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Read-only DTO returned by all Package API responses.
 * Decoupled from the AppPackage entity so internal model changes
 * don't break the API contract.
 */
@Data
@Builder
public class PackageResponse {

    private String id;
    private String name;
    private String description;
    private BigDecimal price;
    private String currency;
    private DurationType durationType;
    private List<TenantModule> appIds;
    private PackageStatus status;
    private LocalDateTime startingDate;
    private LocalDateTime expiringDate;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // ── Factory methods ───────────────────────────────────────────────────────────

    // Maps a standalone AppPackage catalogue entry (no tenant-specific dates).
    // startingDate / expiringDate are left null — they live on the tenant assignment.
    public static PackageResponse from(AppPackage pkg) {
        return PackageResponse.builder()
                .id(pkg.getId())
                .name(pkg.getName())
                .description(pkg.getDescription())
                .price(pkg.getPrice())
                .currency(pkg.getCurrency())
                .durationType(pkg.getDurationType())
                .appIds(pkg.getAppIds())
                .status(pkg.getStatus())
                // startingDate / expiringDate removed from AppPackage — they now live on
                // Tenant.PackageDetails and Tenant.PackageHistory (per-tenant validity window)
                .createdAt(pkg.getCreatedAt())
                .updatedAt(pkg.getUpdatedAt())
                .build();
    }

    // Maps a Tenant.PackageDetails (active assignment) to PackageResponse.
    // Merges catalogue fields from appPackage with tenant-specific validity dates.
    public static PackageResponse from(Tenant.PackageDetails details) {
        if (details == null || details.getAppPackage() == null) return null;
        AppPackage pkg = details.getAppPackage();
        return PackageResponse.builder()
                .id(pkg.getId())
                .name(pkg.getName())
                .description(pkg.getDescription())
                .price(pkg.getPrice())
                .currency(pkg.getCurrency())
                .durationType(pkg.getDurationType())
                .appIds(pkg.getAppIds())
                .status(pkg.getStatus())
                .startingDate(details.getPlanStarted())
                .expiringDate(details.getPlanExpiring())
                .createdAt(pkg.getCreatedAt())
                .updatedAt(pkg.getUpdatedAt())
                .build();
    }

    // Maps a Tenant.PackageHistory entry (past assignment) to PackageResponse.
    // planExpired maps to expiringDate so the API surface stays uniform.
    public static PackageResponse from(Tenant.PackageHistory history) {
        if (history == null || history.getAppPackage() == null) return null;
        AppPackage pkg = history.getAppPackage();
        return PackageResponse.builder()
                .id(pkg.getId())
                .name(pkg.getName())
                .description(pkg.getDescription())
                .price(pkg.getPrice())
                .currency(pkg.getCurrency())
                .durationType(pkg.getDurationType())
                .appIds(pkg.getAppIds())
                .status(pkg.getStatus())
                .startingDate(history.getPlanStarted())
                .expiringDate(history.getPlanExpired())
                .createdAt(pkg.getCreatedAt())
                .updatedAt(pkg.getUpdatedAt())
                .build();
    }
}
