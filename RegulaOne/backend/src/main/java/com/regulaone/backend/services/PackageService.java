package com.regulaone.backend.services;

import com.regulaone.backend.dto.Package.PackagePageResponse;
import com.regulaone.backend.dto.Package.PackageRequest;
import com.regulaone.backend.dto.Package.PackageResponse;
import com.regulaone.backend.dto.Package.PackageTierStatsResponse;
import com.regulaone.backend.dto.Package.TierChangeResponse;

import com.regulaone.backend.models.AppPackage;
import com.regulaone.backend.models.PackageStatus;
import com.regulaone.backend.models.Tenant;
import com.regulaone.backend.repository.PackageRepository;
import com.regulaone.backend.repository.TenantRepository;
import com.regulaone.backend.utils.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PackageService {

    private final PackageRepository packageRepository;
    private final TenantRepository tenantRepository;

    // ── Package CRUD ──────────────────────────────────────────────────────────

    /**
     * //? Creates a new AppPackage after validating name uniqueness and date order.
     */
    public PackageResponse createPackage(PackageRequest request) {

        validateNameUniqueness(request.getName(), null);

        // OLD: date validation was here when startingDate/expiringDate lived on AppPackage.
        // Dates are now tenant-specific (Tenant.PackageDetails.planStarted / planExpiring)
        // and are set when a super-admin assigns this package to a tenant — not here.
        // validateDates(LocalDateTime.now(), request.getExpiringDate());

        AppPackage pkg = AppPackage.builder()
                .name(request.getName())
                .description(request.getDescription())
                .price(request.getPrice())
                .currency(request.getCurrency().toUpperCase())
                .durationType(request.getDurationType())
                .appIds(request.getAppIds())
                .status(request.getStatus() != null ? request.getStatus() : PackageStatus.ACTIVE)
                // OLD: .startingDate(LocalDateTime.now())   — moved to Tenant.PackageDetails.planStarted
                // OLD: .expiringDate(request.getExpiringDate()) — moved to Tenant.PackageDetails.planExpiring
                .build();

        return PackageResponse.from(packageRepository.save(pkg));
    }

    /**
     * Fully replaces an existing AppPackage.
     * Also triggers a re-sync of all tenants assigned to this package
     * so their enabledModules reflect the updated appIds.
     */
    public PackageResponse updatePackage(String id, PackageRequest request) {
        AppPackage pkg = packageRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Package not found with id: " + id));

        validateNameUniqueness(request.getName(), id);

        // OLD: startingDate/expiringDate lived on AppPackage — now on Tenant.PackageDetails.
        // Kept commented for history.
        // LocalDateTime effectiveStart = request.getStartingDate() != null
        //         ? request.getStartingDate()
        //         : LocalDateTime.now();
        // validateDates(effectiveStart, request.getExpiringDate());

        pkg.setName(request.getName());
        pkg.setDescription(request.getDescription());
        pkg.setPrice(request.getPrice());
        pkg.setCurrency(request.getCurrency().toUpperCase());
        pkg.setDurationType(request.getDurationType());
        pkg.setAppIds(request.getAppIds());
        pkg.setStatus(request.getStatus() != null ? request.getStatus() : pkg.getStatus());
        // OLD: pkg.setStartingDate(effectiveStart);   — moved to Tenant.PackageDetails.planStarted
        // OLD: pkg.setExpiringDate(request.getExpiringDate()); — moved to Tenant.PackageDetails.planExpiring
        pkg.setUpdatedAt(LocalDateTime.now());

        PackageResponse saved = PackageResponse.from(packageRepository.save(pkg));

        return saved;
    }

    /**
     * Permanently deletes a package.
     *
     * NEW (@DBRef approach): Before deleting, find all tenants whose currentPackage
     * @DBRef points to this package ID and nullify it — prevents stale DBRef errors
     * when Spring tries to resolve the reference after the document is gone.
     *
     * OLD (TenantPackageRepository approach — removed):
     * // List<String> affectedTenantIds = tenantPackageRepository.findByPackageId(id)...
     * // tenantPackageRepository.findByPackageId(id).forEach(tp -> ...deleteByTenantIdAndPackageId...);
     * // affectedTenantIds.forEach(this::syncTenantModules);
     */
    @Transactional
    public void deletePackage(String id) {
        packageRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Package not found with id: " + id));

        // Nullify currentPackage on any tenant that currently holds a reference to this package.
        // This prevents a MappingException when Spring resolves the @DBRef after the document is deleted.
        // Updated path: currentPackage is now PackageDetails (embedded), so the AppPackage
        // ID lives at currentPackage.appPackage.id — not directly at currentPackage.id.
        List<Tenant> affectedTenants = tenantRepository.findByCurrentPackageAppPackageId(id);
        
        affectedTenants.forEach(tenant -> {
            tenant.setCurrentPackage(null);
            tenant.setUpdatedAt(LocalDateTime.now());
            tenantRepository.save(tenant);
        });

        packageRepository.deleteById(id);
    }

    /**
     * Returns a single package by ID.
     */
    public PackageResponse getPackageById(String id) {
        return PackageResponse.from(
                packageRepository.findById(id)
                        .orElseThrow(() -> new ResourceNotFoundException(
                                "Package not found with id: " + id)));
    }

    /**
     * Returns a paginated, optionally filtered list of packages.
     *
     * Filter logic:
     * search + status → findByNameContainingIgnoreCaseAndStatus
     * search only → findByNameContainingIgnoreCase
     * status only → findByStatus
     * neither → findAll
     *
     * @param search   partial package name (case-insensitive), null to skip
     * @param status   PackageStatus filter, null to return all statuses
     * @param pageable Spring Pageable from request params
     */
    public PackagePageResponse getAllPackages(String search, PackageStatus status, Pageable pageable) {
        boolean hasSearch = search != null && !search.isBlank();
        boolean hasStatus = status != null;

        Page<PackageResponse> page;

        if (hasSearch && hasStatus) {
            page = packageRepository
                    .findByNameContainingIgnoreCaseAndStatus(search, status, pageable)
                    .map(PackageResponse::from);
        } else if (hasSearch) {
            page = packageRepository
                    .findByNameContainingIgnoreCase(search, pageable)
                    .map(PackageResponse::from);
        } else if (hasStatus) {
            page = packageRepository
                    .findByStatus(status, pageable)
                    .map(PackageResponse::from);
        } else {
            page = packageRepository
                    .findAll(pageable)
                    .map(PackageResponse::from);
        }

        return PackagePageResponse.from(page);
    }

    // ── Stats, tier-change history, and billing export ───────────────────────

    /**
     * Aggregates tenant counts per active package and calculates MRR figures.
     *
     * Algorithm:
     *  1. Load all ACTIVE packages from the catalogue.
     *  2. Group all tenants by their currentPackage.appPackage.id.
     *  3. Build a TierStat for each package with tenantCount and tierMrr.
     *  4. Sort descending by tenantCount; mark the first entry as mostPopular.
     *  5. Sum totalMrr and payingTenants across all tiers.
     *
     * Called by GET /api/superadmin/packages/tier-stats.
     */
    public PackageTierStatsResponse getPackageTierStats() {

        List<AppPackage> activePackages = packageRepository.findAll()
                .stream()
                .filter(p -> p.getStatus() == PackageStatus.ACTIVE)
                .collect(Collectors.toList());

        // Count how many tenants are currently on each package ID
        Map<String, Long> countByPackageId = tenantRepository.findAll()
                .stream()
                .filter(t -> t.getCurrentPackage() != null
                        && t.getCurrentPackage().getAppPackage() != null)
                .collect(Collectors.groupingBy(
                        t -> t.getCurrentPackage().getAppPackage().getId(),
                        Collectors.counting()));

        // Build per-tier stats sorted by tenant count descending
        List<PackageTierStatsResponse.TierStat> tierStats = activePackages.stream()
                .map(pkg -> {
                    long count = countByPackageId.getOrDefault(pkg.getId(), 0L);
                    BigDecimal tierMrr = pkg.getPrice() != null
                            ? pkg.getPrice().multiply(BigDecimal.valueOf(count))
                            : BigDecimal.ZERO;
                    return PackageTierStatsResponse.TierStat.builder()
                            .packageId(pkg.getId())
                            .packageName(pkg.getName())
                            .price(pkg.getPrice())
                            .currency(pkg.getCurrency())
                            .tenantCount((int) count)
                            .tierMrr(tierMrr)
                            .usersCapacity(pkg.getUsersCapacity())
                            .appIds(pkg.getAppIds())
                            .mostPopular(false)
                            .status(pkg.getStatus().name())
                            .build();
                })
                .sorted(Comparator.comparingInt(PackageTierStatsResponse.TierStat::getTenantCount)
                        .reversed())
                .collect(Collectors.toList());

        // Mark the single most-popular tier (highest tenant count)
        if (!tierStats.isEmpty()) {
            tierStats.get(0).setMostPopular(true);
        }

        BigDecimal totalMrr = tierStats.stream()
                .map(PackageTierStatsResponse.TierStat::getTierMrr)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        int payingTenants = tierStats.stream()
                .mapToInt(PackageTierStatsResponse.TierStat::getTenantCount)
                .sum();

        PackageTierStatsResponse.TierStat topTier = tierStats.isEmpty() ? null : tierStats.get(0);

        return PackageTierStatsResponse.builder()
                .totalMrr(totalMrr)
                .payingTenants(payingTenants)
                .mostPopularPlan(topTier != null ? topTier.getPackageName() : "—")
                .mostPopularPlanTenantCount(topTier != null ? topTier.getTenantCount() : 0)
                .tiers(tierStats)
                .build();
    }

    /**
     * Returns tier-change events across all tenants, newest first.
     *
     * A tier change is detected when consecutive packageHistory entries for a
     * tenant have different package names — i.e. the tenant switched plans.
     * The most recent change (last history entry → currentPackage) is also
     * included when the plan names differ.
     *
     * @param limit max results to return; null or 0 means return all
     *
     * Called by GET /api/superadmin/tier-changes?limit=4 (recent)
     *        and GET /api/superadmin/tier-changes          (full history).
     */
    public List<TierChangeResponse> getTierChanges(Integer limit) {

        List<TierChangeResponse> changes = new ArrayList<>();

        for (Tenant tenant : tenantRepository.findAll()) {
            List<Tenant.PackageHistory> history = tenant.getPackageHistory();
            if (history == null || history.isEmpty()) continue;

            // Detect changes between consecutive history entries
            for (int i = 1; i < history.size(); i++) {
                Tenant.PackageHistory prev = history.get(i - 1);
                Tenant.PackageHistory curr = history.get(i);
                if (prev.getAppPackage() == null || curr.getAppPackage() == null) continue;

                String prevName = prev.getAppPackage().getName();
                String currName = curr.getAppPackage().getName();

                if (!prevName.equals(currName)) {
                    changes.add(TierChangeResponse.builder()
                            .tenantId(tenant.getId())
                            .tenantName(tenant.getName())
                            .fromPlan(prevName)
                            .toPlan(currName)
                            .changedAt(curr.getPlanStarted())
                            .reason(curr.getReason())
                            .build());
                }
            }

            // Also check if the current active plan differs from the last history entry
            Tenant.PackageHistory last = history.get(history.size() - 1);
            if (tenant.getCurrentPackage() != null
                    && tenant.getCurrentPackage().getAppPackage() != null
                    && last.getAppPackage() != null) {

                String lastName    = last.getAppPackage().getName();
                String currentName = tenant.getCurrentPackage().getAppPackage().getName();

                if (!currentName.equals(lastName)) {
                    changes.add(TierChangeResponse.builder()
                            .tenantId(tenant.getId())
                            .tenantName(tenant.getName())
                            .fromPlan(lastName)
                            .toPlan(currentName)
                            .changedAt(tenant.getCurrentPackage().getPlanStarted())
                            .reason(null)
                            .build());
                }
            }
        }

        // Sort newest first so callers don't have to sort themselves
        changes.sort(Comparator.comparing(TierChangeResponse::getChangedAt,
                Comparator.nullsLast(Comparator.reverseOrder())));

        if (limit != null && limit > 0 && changes.size() > limit) {
            return changes.subList(0, limit);
        }

        return changes;
    }

    /**
     * Generates a CSV string covering all tenants with an active package.
     *
     * Columns: Tenant Name, NIP, Package, Price, Currency, Plan Started, Plan Expiring, Status
     *
     * Called by GET /api/superadmin/tier-changes/export — the controller sets
     * Content-Type: text/csv and Content-Disposition so the browser saves the file.
     */
    public String exportBillingCsv() {

        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd");

        StringBuilder csv = new StringBuilder();
        csv.append("Tenant Name,NIP,Package,Price,Currency,Plan Started,Plan Expiring,Status\n");

        for (Tenant tenant : tenantRepository.findAll()) {
            if (tenant.getCurrentPackage() == null
                    || tenant.getCurrentPackage().getAppPackage() == null) continue;

            AppPackage pkg = tenant.getCurrentPackage().getAppPackage();
            String started  = tenant.getCurrentPackage().getPlanStarted() != null
                    ? tenant.getCurrentPackage().getPlanStarted().format(fmt) : "";
            String expiring = tenant.getCurrentPackage().getPlanExpiring() != null
                    ? tenant.getCurrentPackage().getPlanExpiring().format(fmt) : "";

            csv.append(String.format("\"%s\",\"%s\",\"%s\",%.2f,%s,%s,%s,%s%n",
                    escapeCsv(tenant.getName()),
                    tenant.getNip() != null ? tenant.getNip() : "",
                    pkg.getName(),
                    pkg.getPrice() != null ? pkg.getPrice() : BigDecimal.ZERO,
                    pkg.getCurrency() != null ? pkg.getCurrency() : "",
                    started,
                    expiring,
                    tenant.getStatus().name()));
        }

        return csv.toString();
    }

    // Escapes double-quotes inside CSV field values to prevent injection.
    private String escapeCsv(String value) {
        return value != null ? value.replace("\"", "\"\"") : "";
    }

    //TODO: ── Private Helpers ───────────────────────────────────────────────────────

    // OLD: syncTenantModules() removed — app access is now derived from Tenant.currentPackage.appIds
    // at query time, so there is no denormalized list to keep in sync.
    // private void syncTenantModules(String tenantId) { ... }

    // OLD: validateDates() removed from PackageService — startingDate/expiringDate now live
    // on Tenant.PackageDetails (per-tenant assignment), not on the AppPackage catalogue entry.
    // Date validation should be performed in the tenant-package assignment flow instead.
    //
    // private void validateDates(LocalDateTime startingDate, LocalDateTime expiringDate) {
    //     if (!expiringDate.isAfter(startingDate)) {
    //         throw new IllegalArgumentException("expiringDate must be after startingDate");
    //     }
    // }

    /**
     * Validates package name uniqueness.
     * 
     * @param excludeId pass the current package ID on updates to exclude self-match
     */
    private void validateNameUniqueness(String name, String excludeId) {
        boolean conflict = (excludeId == null)
                ? packageRepository.existsByName(name)
                : packageRepository.existsByNameAndIdNot(name, excludeId);

        if (conflict) {
            throw new IllegalArgumentException(
                    "A package with name '" + name + "' already exists");
        }
    }

}
