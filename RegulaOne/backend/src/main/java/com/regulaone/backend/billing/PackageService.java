package com.regulaone.backend.billing;

import com.regulaone.backend.billing.dto.AdminPackageResponse;
import com.regulaone.backend.billing.dto.PackagePageResponse;
import com.regulaone.backend.billing.dto.PackageRequest;
import com.regulaone.backend.billing.dto.PackageResponse;
import com.regulaone.backend.billing.dto.PackageTierStatsResponse;
import com.regulaone.backend.common.ResourceNotFoundException;
import com.regulaone.backend.models.AppPackage;
import com.regulaone.backend.models.PackageStatus;
import com.regulaone.backend.tenant.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * THE PLAN CATALOGUE: what RegulaOne sells, and how the tiers are performing.
 *
 * It owns the {@code packages} collection — creating, editing, retiring and listing plans
 * — and nothing else. What an individual CUSTOMER is subscribed to, and how that changes,
 * belongs to {@link SubscriptionService}. The two used to be one class of nearly 700
 * lines; splitting them means a change to the price list cannot break a renewal.
 *
 * Two audiences read from here:
 *   * the platform operator, who manages the catalogue (/api/superadmin/packages)
 *   * a company administrator, who compares the plans on offer (/api/admin/packages)
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class PackageService {

    private final PackageRepository packageRepository;
    private final TenantRepository tenantRepository;
    private final SubscriptionService subscriptionService;

    // ── Catalogue: create, edit, retire ───────────────────────────────────────

    /**
     * Adds a plan to the catalogue.
     *
     * Dates are deliberately absent: a plan's start and expiry are per-CUSTOMER and are
     * set when the plan is assigned (see {@code Tenant.PackageDetails}), not on the
     * catalogue entry.
     */
    public PackageResponse createPackage(PackageRequest request) {

        validateNameUniqueness(request.getName(), null);

        AppPackage pkg = AppPackage.builder()
                .name(request.getName())
                .description(request.getDescription())
                .price(request.getPrice())
                .currency(request.getCurrency().toUpperCase())
                .durationType(request.getDurationType())
                .duration(request.getDuration())
                // 0 is stored as-is; the seat check in UserAdminService.inviteUser treats
                // null or 0 as "no limit" (unlimited seats).
                .usersCapacity(request.getUsersCapacity())
                .appIds(request.getAppIds())
                .status(request.getStatus() != null ? request.getStatus() : PackageStatus.ACTIVE)
                .build();

        return PackageResponse.from(packageRepository.save(pkg));
    }

    /**
     * Fully replaces an existing plan (PUT semantics — every field is taken from the
     * request), except that a missing status leaves the current one alone.
     *
     * Existing customers are NOT re-billed or re-dated by this: their assignment keeps the
     * price and dates it was created with. Only the module list takes effect immediately,
     * because entitlement is read from the plan at query time.
     */
    public PackageResponse updatePackage(String id, PackageRequest request) {
        AppPackage pkg = packageRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Package not found with id: " + id));

        validateNameUniqueness(request.getName(), id);

        pkg.setName(request.getName());
        pkg.setDescription(request.getDescription());
        pkg.setPrice(request.getPrice());
        pkg.setCurrency(request.getCurrency().toUpperCase());
        pkg.setDurationType(request.getDurationType());
        pkg.setDuration(request.getDuration());
        pkg.setUsersCapacity(request.getUsersCapacity());
        pkg.setAppIds(request.getAppIds());
        pkg.setStatus(request.getStatus() != null ? request.getStatus() : pkg.getStatus());
        pkg.setUpdatedAt(LocalDateTime.now());

        return PackageResponse.from(packageRepository.save(pkg));
    }

    /**
     * Permanently deletes a plan.
     *
     * Any customer currently on it is detached first — by
     * {@link SubscriptionService#detachPackageFromTenants}, which closes their period in
     * the ledger so the trail still shows they HAD this plan. Skipping that step would
     * leave a dangling @DBRef and break the next read of those tenants.
     */
    @Transactional
    public void deletePackage(String id) {
        packageRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Package not found with id: " + id));

        subscriptionService.detachPackageFromTenants(id);

        packageRepository.deleteById(id);
    }

    // ── Catalogue: read ───────────────────────────────────────────────────────

    /** One plan by id. */
    public PackageResponse getPackageById(String id) {
        return PackageResponse.from(
                packageRepository.findById(id)
                        .orElseThrow(() -> new ResourceNotFoundException(
                                "Package not found with id: " + id)));
    }

    /**
     * A paginated, optionally filtered list of plans for the operator's catalogue screen.
     *
     * @param search   partial plan name (case-insensitive), null to skip
     * @param status   status filter, null to return all statuses
     * @param pageable page, size and sort — built by the controller via PageRequests
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

    /**
     * Every ACTIVE plan, cheapest first — the plans a company administrator may compare
     * on their "My Plan" page (GET /api/admin/packages).
     *
     * Retired plans are left out on purpose: a customer must not be shown something they
     * can no longer buy.
     */
    public List<AdminPackageResponse> getActivePackages() {
        return packageRepository.findAll().stream()
                .filter(p -> p.getStatus() == PackageStatus.ACTIVE)
                .sorted(Comparator.comparing(AppPackage::getPrice))
                .map(AdminPackageResponse::from)
                .collect(Collectors.toList());
    }

    // ── Tier performance ──────────────────────────────────────────────────────

    /**
     * How many customers each ACTIVE tier has, and what each tier is worth per month.
     *
     * How it is worked out:
     *  1. Load the ACTIVE plans from the catalogue.
     *  2. Group all tenants by the plan they are currently on.
     *  3. Build one TierStat per plan (customer count × price = that tier's MRR).
     *  4. Sort by customer count, highest first, and mark the leader as most popular.
     *  5. Total the MRR and the paying customers across the tiers.
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
                            .durationType(pkg.getDurationType())
                            .duration(pkg.getDuration())
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

    // ── Validation ────────────────────────────────────────────────────────────

    /**
     * Two plans must never share a name: the name is what appears on an invoice, so a
     * duplicate would make a bill ambiguous.
     *
     * @param excludeId the plan's own id on an update, so it does not clash with itself
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
