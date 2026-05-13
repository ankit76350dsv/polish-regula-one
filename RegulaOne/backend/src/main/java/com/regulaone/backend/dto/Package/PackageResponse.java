package com.regulaone.backend.dto.Package;

import com.regulaone.backend.models.AppPackage;
import com.regulaone.backend.models.DurationType;
import com.regulaone.backend.models.PackageStatus;
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

    /**
     * Maps an AppPackage entity to a PackageResponse DTO.
     * All API responses go through this factory method to ensure consistency.
     */
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
                .startingDate(pkg.getStartingDate())
                .expiringDate(pkg.getExpiringDate())
                .createdAt(pkg.getCreatedAt())
                .updatedAt(pkg.getUpdatedAt())
                .build();
    }
}
