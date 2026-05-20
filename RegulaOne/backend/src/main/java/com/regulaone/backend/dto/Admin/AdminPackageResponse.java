package com.regulaone.backend.dto.Admin;

import com.regulaone.backend.models.AppPackage;
import com.regulaone.backend.models.TenantModule;
import lombok.*;

import java.math.BigDecimal;
import java.util.List;

// Response DTO for GET /api/admin/packages.
// Returns the fields an admin needs to compare plans on the My Plan page.
// Excludes internal fields (status, audit timestamps) — those are superadmin concerns.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminPackageResponse {

    private String id;
    private String name;
    private String description;
    private BigDecimal price;
    private String currency;
    // null means unlimited seats
    private Integer usersCapacity;
    private List<TenantModule> appIds;

    public static AdminPackageResponse from(AppPackage pkg) {
        return AdminPackageResponse.builder()
                .id(pkg.getId())
                .name(pkg.getName())
                .description(pkg.getDescription())
                .price(pkg.getPrice())
                .currency(pkg.getCurrency() != null ? pkg.getCurrency() : "EUR")
                .usersCapacity(pkg.getUsersCapacity())
                .appIds(pkg.getAppIds())
                .build();
    }
}
