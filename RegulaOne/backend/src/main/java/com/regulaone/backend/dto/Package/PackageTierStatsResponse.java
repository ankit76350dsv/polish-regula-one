package com.regulaone.backend.dto.Package;

import com.regulaone.backend.models.TenantModule;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * Response for GET /api/superadmin/packages/tier-stats.
 *
 * Returned when the License Tiers page loads — drives the MRR summary cards
 * and the per-tier package cards with tenant counts, MRR, and module lists.
 *
 * Built by PackageService.getPackageTierStats() which:
 *   1. Loads all ACTIVE packages from the catalogue.
 *   2. Counts how many tenants have each package as their currentPackage.
 *   3. Calculates tierMrr = price × tenantCount per package.
 *   4. Sums up totalMrr and payingTenants across all tiers.
 *   5. Marks the tier with the highest tenantCount as mostPopular.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PackageTierStatsResponse {

    // Platform-wide MRR: sum of (price × tenantCount) for every active tier.
    private BigDecimal totalMrr;

    // Total number of tenants that have an active package assigned.
    private int payingTenants;

    // Name of the package tier with the most tenants.
    private String mostPopularPlan;

    // Tenant count for the most popular tier — shown in the summary card subtitle.
    private int mostPopularPlanTenantCount;

    // Ordered list of tier stats — sorted by tenantCount descending so the
    // most popular tier is always first in the response.
    private List<TierStat> tiers;

    /**
     * Per-tier statistics — one entry per active AppPackage.
     * Used to render each package card in the License Tiers grid.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TierStat {

        private String packageId;
        private String packageName;
        private BigDecimal price;

        // ISO 4217 currency code (EUR, PLN).
        private String currency;

        // How many tenants currently have this package as their active plan.
        private int tenantCount;

        // tierMrr = price × tenantCount — revenue contribution from this tier.
        private BigDecimal tierMrr;

        // Maximum number of users allowed on this tier (null = unlimited).
        private Integer usersCapacity;

        // Compliance modules included in this tier — subset of TenantModule enum.
        private List<TenantModule> appIds;

        // True for the single tier with the highest tenantCount.
        // Set by the service after all tiers are built.
        private boolean mostPopular;

        // Package status (ACTIVE / INACTIVE) — frontend may use to grey out inactive tiers.
        private String status;
    }
}
