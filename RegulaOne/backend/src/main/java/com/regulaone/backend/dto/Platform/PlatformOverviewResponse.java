package com.regulaone.backend.dto.Platform;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;

// Response shape for GET /api/superadmin/overview.
// Drives the four stat cards, the revenue line chart, and the module usage bars
// on the SuperAdmin Platform Overview page.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlatformOverviewResponse {

    // ── Stat cards ────────────────────────────────────────────────────────────
    private long   activeTenants;
    private String tenantTrend;      // e.g. "+12%", "steady", "New", "—"

    private long   totalUsers;
    private String userTrend;        // e.g. "+4%"

    private BigDecimal monthlyRevenue; // current MRR (sum of all active package prices)
    private String     revenueTrend;   // month-over-month revenue change

    private String complianceScore;  // e.g. "99.8%"  (active-plan tenants / total tenants)

    // ── Revenue line chart — last 6 calendar months ────────────────────────
    private List<MonthlyRevenueStat> revenueByMonth;

    // ── Module adoption bars — one entry per TenantModule enum value ───────
    private List<ModuleUsageStat> moduleUsage;

    // ── Embedded shapes ────────────────────────────────────────────────────

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MonthlyRevenueStat {
        private String     month; // "Jan", "Feb", …
        private BigDecimal value; // total plan-price revenue active that month
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ModuleUsageStat {
        private String module;   // TenantModule enum name, e.g. "KSEFFLOW"
        private int    usagePct; // 0–100: % of active tenants whose package includes this module
    }
}
