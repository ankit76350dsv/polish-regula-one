package com.regulaone.backend.services;

import com.regulaone.backend.dto.Platform.PlatformOverviewResponse;
import com.regulaone.backend.models.Tenant;
import com.regulaone.backend.models.TenantModule;
import com.regulaone.backend.models.TenantStatus;
import com.regulaone.backend.models.User;
import com.regulaone.backend.repository.TenantRepository;
import com.regulaone.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.TextStyle;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PlatformService {

    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;

    public PlatformOverviewResponse getPlatformOverview() {

        LocalDateTime now = LocalDateTime.now();

        LocalDateTime startOfThisMonth = now.withDayOfMonth(1)
                .withHour(0)
                .withMinute(0)
                .withSecond(0)
                .withNano(0);

        LocalDateTime startOfLastMonth = startOfThisMonth.minusMonths(1);

        List<Tenant> allTenants = tenantRepository.findAll();
        List<User> allUsers = userRepository.findAll();

        // ─────────────────────────────────────────────────────────────
        // Active tenants
        // ─────────────────────────────────────────────────────────────

        long activeTenants = allTenants.stream()
                .filter(t -> t.getStatus() == TenantStatus.ACTIVE)
                .count();

        // ─────────────────────────────────────────────────────────────
        // Tenant growth
        // ─────────────────────────────────────────────────────────────

        long tenantsThisMonth = allTenants.stream()
                .filter(t ->
                        t.getCreatedAt() != null
                                && t.getCreatedAt().isAfter(startOfThisMonth))
                .count();

        long tenantsLastMonth = allTenants.stream()
                .filter(t ->
                        t.getCreatedAt() != null
                                && t.getCreatedAt().isAfter(startOfLastMonth)
                                && t.getCreatedAt().isBefore(startOfThisMonth))
                .count();

        String tenantTrend = growthStr(tenantsLastMonth, tenantsThisMonth);

        // ─────────────────────────────────────────────────────────────
        // Total enabled users
        // ─────────────────────────────────────────────────────────────

        List<User> enabledUsers = allUsers.stream()
                .filter(User::isEnabled)
                .collect(Collectors.toList());

        long totalUsers = enabledUsers.size();

        // ─────────────────────────────────────────────────────────────
        // User growth
        // ─────────────────────────────────────────────────────────────

        long usersThisMonth = allUsers.stream()
                .filter(u ->
                        u.getCreatedAt() != null
                                && u.getCreatedAt().isAfter(startOfThisMonth))
                .count();

        long usersLastMonth = allUsers.stream()
                .filter(u ->
                        u.getCreatedAt() != null
                                && u.getCreatedAt().isAfter(startOfLastMonth)
                                && u.getCreatedAt().isBefore(startOfThisMonth))
                .count();

        String userTrend = growthStr(usersLastMonth, usersThisMonth);

        // ─────────────────────────────────────────────────────────────
        // Current Monthly Revenue
        // ─────────────────────────────────────────────────────────────

        BigDecimal monthlyRevenue = allTenants.stream()
                .filter(t ->
                        t.getStatus() == TenantStatus.ACTIVE
                                && t.getCurrentPackage() != null
                                && t.getCurrentPackage().getAppPackage() != null
                                && t.getCurrentPackage().getAppPackage().getPrice() != null)
                .map(t -> t.getCurrentPackage().getAppPackage().getPrice())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // ─────────────────────────────────────────────────────────────
        // Compliance Score
        // ─────────────────────────────────────────────────────────────

        long compliant = allTenants.stream()
                .filter(t ->
                        t.getStatus() == TenantStatus.ACTIVE
                                && t.getCurrentPackage() != null
                                && (
                                t.getCurrentPackage().getPlanExpiring() == null
                                        || t.getCurrentPackage()
                                        .getPlanExpiring()
                                        .isAfter(now)
                        ))
                .count();

        double scoreRaw = allTenants.isEmpty()
                ? 100.0
                : compliant * 100.0 / allTenants.size();

        String complianceScore = String.format("%.1f%%", scoreRaw);

        // ─────────────────────────────────────────────────────────────
        // Revenue By Month
        // Revenue is counted based on packageHistory.planStarted
        // ─────────────────────────────────────────────────────────────

        List<PlatformOverviewResponse.MonthlyRevenueStat> revenueByMonth =
                new ArrayList<>();

        for (int i = 5; i >= 0; i--) {

            LocalDateTime mStart = startOfThisMonth.minusMonths(i);
            LocalDateTime mEnd = mStart.plusMonths(1).minusNanos(1);

            BigDecimal revenue = BigDecimal.ZERO;

            for (Tenant tenant : allTenants) {

                if (tenant.getPackageHistory() != null) {

                    for (Tenant.PackageHistory history : tenant.getPackageHistory()) {

                        if (history.getPlanStarted() != null
                                && isWithinMonth(history.getPlanStarted(), mStart, mEnd)
                                && history.getAppPackage() != null
                                && history.getAppPackage().getPrice() != null) {

                            revenue = revenue.add(
                                    history.getAppPackage().getPrice()
                            );
                        }
                    }
                }
            }

            revenueByMonth.add(
                    PlatformOverviewResponse.MonthlyRevenueStat.builder()
                            .month(
                                    mStart.getMonth()
                                            .getDisplayName(
                                                    TextStyle.SHORT,
                                                    Locale.ENGLISH
                                            )
                            )
                            .value(revenue)
                            .build()
            );
        }

        // ─────────────────────────────────────────────────────────────
        // Revenue Trend
        // ─────────────────────────────────────────────────────────────

        String revenueTrend = revTrendStr(
                revenueByMonth.get(4).getValue(),
                revenueByMonth.get(5).getValue()
        );

        // ─────────────────────────────────────────────────────────────
        // Module Usage
        // Percentage based on highest-used module
        // ─────────────────────────────────────────────────────────────

        Map<TenantModule, Long> moduleCounts = new HashMap<>();

        for (TenantModule mod : TenantModule.values()) {

            long count = enabledUsers.stream()
                    .filter(u ->
                            u.getModuleIds() != null
                                    && u.getModuleIds().contains(mod))
                    .count();

            moduleCounts.put(mod, count);
        }

        long highestCount = moduleCounts.values().stream()
                .max(Long::compareTo)
                .orElse(0L);

        List<PlatformOverviewResponse.ModuleUsageStat> moduleUsage =
                new ArrayList<>();

        for (TenantModule mod : TenantModule.values()) {

            long count = moduleCounts.getOrDefault(mod, 0L);

            int pct = highestCount == 0
                    ? 0
                    : (int) Math.round(count * 100.0 / highestCount);

            moduleUsage.add(
                    PlatformOverviewResponse.ModuleUsageStat.builder()
                            .module(mod.name())
                            .usagePct(pct)
                            .build()
            );
        }

        // ─────────────────────────────────────────────────────────────
        // Final Response
        // ─────────────────────────────────────────────────────────────

        return PlatformOverviewResponse.builder()
                .activeTenants(activeTenants)
                .tenantTrend(tenantTrend)
                .totalUsers(totalUsers)
                .userTrend(userTrend)
                .monthlyRevenue(monthlyRevenue)
                .revenueTrend(revenueTrend)
                .complianceScore(complianceScore)
                .revenueByMonth(revenueByMonth)
                .moduleUsage(moduleUsage)
                .build();
    }

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    private boolean isWithinMonth(
            LocalDateTime date,
            LocalDateTime start,
            LocalDateTime end
    ) {
        return !date.isBefore(start) && !date.isAfter(end);
    }

    private String growthStr(long prev, long curr) {

        if (prev == 0) {
            return curr > 0 ? "New" : "—";
        }

        double pct = (curr - prev) * 100.0 / prev;

        if (Math.abs(pct) < 1) {
            return "steady";
        }

        return (pct > 0 ? "+" : "")
                + String.format("%.0f%%", pct);
    }

    private String revTrendStr(BigDecimal prev, BigDecimal curr) {

        if (prev == null || prev.compareTo(BigDecimal.ZERO) == 0) {
            return (curr != null && curr.compareTo(BigDecimal.ZERO) > 0)
                    ? "New"
                    : "—";
        }

        BigDecimal pct = curr.subtract(prev)
                .divide(prev, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));

        if (pct.abs().compareTo(BigDecimal.valueOf(2)) < 0) {
            return "steady";
        }

        return (pct.compareTo(BigDecimal.ZERO) > 0 ? "+" : "")
                + pct.setScale(0, RoundingMode.HALF_UP)
                + "%";
    }
}