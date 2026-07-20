package com.regulaone.backend.services;

import com.regulaone.backend.dto.Package.PackageChangeResponse;
import com.regulaone.backend.dto.Package.PackagePageResponse;
import com.regulaone.backend.dto.Package.PackageRenewalResponse;
import com.regulaone.backend.dto.Package.PackageRequest;
import com.regulaone.backend.dto.Package.PackageResponse;
import com.regulaone.backend.dto.Package.PackageTierStatsResponse;
import com.regulaone.backend.dto.Package.RenewPackageRequest;
import com.regulaone.backend.dto.Package.TierChangeResponse;
import com.regulaone.backend.dto.Package.UpgradePackageRequest;

import com.regulaone.backend.models.AppPackage;
import com.regulaone.backend.models.DurationType;
import com.regulaone.backend.models.Invoice;
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
    private final BillingService billingService;

    // ── Package renewal ───────────────────────────────────────────────────────

    /**
     * Renews a tenant's CURRENT package for another billing period.
     *
     * What it does, in order:
     *  1. Loads the tenant and checks it actually has an active package.
     *  2. Blocks renewal for LIFETIME plans (they never expire) and for packages
     *     whose catalogue entry is no longer ACTIVE.
     *  3. Extends the validity window. If the plan is still valid, the new period
     *     is STACKED on top of the current expiry (no time is lost); if it already
     *     lapsed, a fresh period starts from now.
     *  4. Archives the window that is ending into the tenant's packageHistory
     *     (audit trail), with the supplied reason (or a default).
     *  5. Generates an invoice for the renewal (FREE if the package is no-charge,
     *     otherwise PAID) covering the exact new period.
     *
     * @Transactional so the tenant update and the invoice are consistent.
     */
    @Transactional
    public PackageRenewalResponse renewTenantPackage(String tenantId, RenewPackageRequest request) {

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant not found: " + tenantId));

        Tenant.PackageDetails current = tenant.getCurrentPackage();
        if (current == null || current.getAppPackage() == null) {
            throw new IllegalStateException("Tenant has no active package to renew");
        }

        AppPackage pkg = current.getAppPackage();

        // A LIFETIME plan never expires, so there is nothing to renew.
        if (pkg.getDurationType() == DurationType.LIFETIME || pkg.getDuration() == null) {
            throw new IllegalStateException("LIFETIME packages do not require renewal");
        }

        // Do not renew onto a package that has been retired from the catalogue.
        if (pkg.getStatus() != PackageStatus.ACTIVE) {
            throw new IllegalStateException(
                    "Cannot renew because the package '" + pkg.getName() + "' is not ACTIVE");
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime oldStart = current.getPlanStarted() != null ? current.getPlanStarted() : now;
        LocalDateTime oldExpiring = current.getPlanExpiring();

        // Stack remaining time: extend from the current expiry if the plan is still
        // valid, otherwise start a fresh window from now.
        LocalDateTime baseDate = (oldExpiring != null && oldExpiring.isAfter(now)) ? oldExpiring : now;
        LocalDateTime newExpiring = baseDate.plusDays(pkg.getDuration());

        String reason = (request != null && request.getReason() != null && !request.getReason().isBlank())
                ? request.getReason().trim()
                : "Package renewal";

        // 1. Archive the window that is ending into history (never removed — audit trail).
        Tenant.PackageHistory history = Tenant.PackageHistory.builder()
                .appPackage(pkg)
                .planStarted(oldStart)
                .planExpired(oldExpiring != null ? oldExpiring : now)
                .usersCapacity(current.getUsersCapacity())
                .reason(reason)
                .build();
        tenant.getPackageHistory().add(history);

        // 2. Update the active window — same tier, extended expiry.
        current.setPlanStarted(baseDate);
        current.setPlanExpiring(newExpiring);
        tenant.setUpdatedAt(now);
        tenantRepository.save(tenant);

        // 3. Bill the renewal. Free packages produce a FREE (zero-amount) invoice.
        boolean isFree = pkg.getPrice() == null || pkg.getPrice().compareTo(BigDecimal.ZERO) == 0;
        Invoice invoice = billingService.generateInvoice(tenant, pkg, isFree, baseDate, newExpiring);

        return PackageRenewalResponse.builder()
                .tenantId(tenant.getId())
                .tenantName(tenant.getName())
                .packageName(pkg.getName())
                .planStarted(baseDate)
                .planExpiring(newExpiring)
                .invoiceNumber(invoice.getInvoiceNumber())
                .amount(invoice.getAmount())
                .currency(invoice.getCurrency())
                .reason(reason)
                .build();
    }

    // ── Package upgrade / change ──────────────────────────────────────────────

    /**
     * Moves a tenant to a DIFFERENT package tier (upgrade or downgrade).
     *
     * What it does, in order:
     *  1. Loads the tenant and the target package; 404 if either is missing.
     *  2. Blocks the change if the target package is not ACTIVE, or if it is the
     *     same package the tenant already has (renew should be used instead).
     *  3. Archives the outgoing plan into packageHistory (planExpired = now).
     *  4. Sets a fresh validity window for the NEW plan starting now
     *     (planExpiring = now + duration, or null for LIFETIME).
     *  5. Generates an invoice for the new plan (FREE if no-charge, else PAID).
     *
     * Unlike renewal, this starts a brand-new period now — the old plan ends
     * immediately, so no time is carried over.
     *
     * @Transactional so the tenant update and the invoice stay consistent.
     */
    @Transactional
    public PackageChangeResponse upgradeTenantPackage(String tenantId, UpgradePackageRequest request) {

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant not found: " + tenantId));

        AppPackage newPkg = packageRepository.findById(request.getPackageId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Package not found: " + request.getPackageId()));

        if (newPkg.getStatus() != PackageStatus.ACTIVE) {
            throw new IllegalStateException(
                    "Cannot switch to package '" + newPkg.getName() + "' because it is not ACTIVE");
        }

        Tenant.PackageDetails current = tenant.getCurrentPackage();
        String fromName = (current != null && current.getAppPackage() != null)
                ? current.getAppPackage().getName() : null;

        // Same tier → not an upgrade. Renewal is the correct operation for that.
        if (current != null && current.getAppPackage() != null
                && newPkg.getId().equals(current.getAppPackage().getId())) {
            throw new IllegalStateException(
                    "Tenant is already on package '" + newPkg.getName() + "'. Use renew to extend it.");
        }

        LocalDateTime now = LocalDateTime.now();

        String reason = (request.getReason() != null && !request.getReason().isBlank())
                ? request.getReason().trim()
                : "Plan change to " + newPkg.getName();

        // 1. Archive the outgoing plan (if any) into history — the old plan ends now.
        if (current != null && current.getAppPackage() != null) {
            Tenant.PackageHistory history = Tenant.PackageHistory.builder()
                    .appPackage(current.getAppPackage())
                    .planStarted(current.getPlanStarted() != null ? current.getPlanStarted() : now)
                    .planExpired(now)
                    .usersCapacity(current.getUsersCapacity())
                    .reason(reason)
                    .build();
            tenant.getPackageHistory().add(history);
        }

        // 2. Start a fresh window for the NEW plan.
        boolean lifetime = newPkg.getDurationType() == DurationType.LIFETIME || newPkg.getDuration() == null;
        LocalDateTime newExpiring = lifetime ? null : now.plusDays(newPkg.getDuration());

        Tenant.PackageDetails updated = Tenant.PackageDetails.builder()
                .appPackage(newPkg)
                .planStarted(now)
                .planExpiring(newExpiring)
                .usersCapacity(newPkg.getUsersCapacity() != null
                        ? String.valueOf(newPkg.getUsersCapacity()) : null)
                .build();
        tenant.setCurrentPackage(updated);
        tenant.setUpdatedAt(now);
        tenantRepository.save(tenant);

        // 3. Bill the new plan. Free packages produce a FREE (zero-amount) invoice.
        boolean isFree = newPkg.getPrice() == null || newPkg.getPrice().compareTo(BigDecimal.ZERO) == 0;
        LocalDateTime periodEnd = (newExpiring != null) ? newExpiring : now.plusMonths(1);
        Invoice invoice = billingService.generateInvoice(tenant, newPkg, isFree, now, periodEnd);

        return PackageChangeResponse.builder()
                .tenantId(tenant.getId())
                .tenantName(tenant.getName())
                .fromPackage(fromName)
                .toPackage(newPkg.getName())
                .planStarted(now)
                .planExpiring(newExpiring)
                .invoiceNumber(invoice.getInvoiceNumber())
                .amount(invoice.getAmount())
                .currency(invoice.getCurrency())
                .reason(reason)
                .build();
    }

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
                .duration(request.getDuration())
                // Added: usersCapacity is now part of PackageRequest so it can be set on creation.
                // 0 is stored as-is; the seat-enforcement logic in UserService.inviteUser()
                // treats null or 0 as no limit (unlimited seats).
                .usersCapacity(request.getUsersCapacity())
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
        pkg.setDuration(request.getDuration());
        // Added: keep usersCapacity in sync on updates — mirrors createPackage handling.
        pkg.setUsersCapacity(request.getUsersCapacity());
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

    /**
     * Returns package assignment events across all tenants, newest first.
     *
     * Updated algorithm — collects ALL assignment events, not just plan-name changes:
     *  1. For each tenant with a currentPackage: add one entry for the active assignment.
     *  2. For each tenant's packageHistory: add one entry per historical assignment.
     *  3. Sort all events newest-first by planStarted.
     *  4. Apply limit if specified.
     *
     * This allows the frontend to display "Recent Plan Assignments" (who bought what and when)
     * rather than only showing tenants that switched plans.
     *
     * OLD approach (commented out below) — was detecting consecutive packageHistory entries
     * with different package names. This missed initial assignments and produced an empty table
     * for tenants that only ever had one plan.
     *
     * @param limit max results to return; null or 0 means return all
     *
     * Called by GET /api/superadmin/tier-changes?limit=4 (recent)
     *        and GET /api/superadmin/tier-changes          (full history).
     */
    public List<TierChangeResponse> getTierChanges(Integer limit) {

        List<TierChangeResponse> assignments = new ArrayList<>();

        for (Tenant tenant : tenantRepository.findAll()) {

            // Capture the planStarted of the current assignment so we can skip the
            // matching packageHistory entry below (the same assignment is written to
            // both currentPackage and packageHistory, causing duplicates).
            LocalDateTime currentPlanStarted = null;

            // 1. Current active assignment — always included; carries planExpiring.
            if (tenant.getCurrentPackage() != null
                    && tenant.getCurrentPackage().getAppPackage() != null) {
                currentPlanStarted = tenant.getCurrentPackage().getPlanStarted();
                assignments.add(TierChangeResponse.builder()
                        .tenantId(tenant.getId())
                        .tenantName(tenant.getName())
                        .toPlan(tenant.getCurrentPackage().getAppPackage().getName())
                        .changedAt(currentPlanStarted)
                        .planExpiring(tenant.getCurrentPackage().getPlanExpiring())
                        // PackageDetails has no reason field — reason is only on PackageHistory.
                        .reason(null)
                        .build());
            }

            // 2. Historical assignments — skip the entry whose planStarted matches the
            //    current package to avoid the duplicate that appears when the same
            //    assignment is written to both currentPackage and packageHistory.
            List<Tenant.PackageHistory> history = tenant.getPackageHistory();
            if (history != null) {
                for (Tenant.PackageHistory h : history) {
                    if (h.getAppPackage() == null) continue;

                    // Skip if this history entry IS the current active assignment
                    if (currentPlanStarted != null
                            && currentPlanStarted.equals(h.getPlanStarted())) {
                        continue;
                    }

                    assignments.add(TierChangeResponse.builder()
                            .tenantId(tenant.getId())
                            .tenantName(tenant.getName())
                            .toPlan(h.getAppPackage().getName())
                            .changedAt(h.getPlanStarted())
                            // planExpiring is not stored on PackageHistory (only planExpired is);
                            // left null for past entries — frontend renders "—".
                            .planExpiring(null)
                            .reason(h.getReason())
                            .build());
                }
            }
        }

        // Sort newest first so callers don't have to sort themselves
        assignments.sort(Comparator.comparing(TierChangeResponse::getChangedAt,
                Comparator.nullsLast(Comparator.reverseOrder())));

        if (limit != null && limit > 0 && assignments.size() > limit) {
            return assignments.subList(0, limit);
        }

        return assignments;

        // OLD implementation — kept for history:
        // Was detecting plan-name changes between consecutive packageHistory entries.
        // Problem: missed initial assignments (first plan has no "from") and returned
        // nothing for tenants that never changed plans.
        //
        // for (Tenant tenant : tenantRepository.findAll()) {
        //     List<Tenant.PackageHistory> history = tenant.getPackageHistory();
        //     if (history == null || history.isEmpty()) continue;
        //     for (int i = 1; i < history.size(); i++) {
        //         Tenant.PackageHistory prev = history.get(i - 1);
        //         Tenant.PackageHistory curr = history.get(i);
        //         if (prev.getAppPackage() == null || curr.getAppPackage() == null) continue;
        //         if (!prev.getAppPackage().getName().equals(curr.getAppPackage().getName())) {
        //             changes.add(TierChangeResponse.builder()
        //                 .tenantId(tenant.getId()).tenantName(tenant.getName())
        //                 .fromPlan(prev.getAppPackage().getName())
        //                 .toPlan(curr.getAppPackage().getName())
        //                 .changedAt(curr.getPlanStarted()).reason(curr.getReason()).build());
        //         }
        //     }
        //     // Also checked currentPackage vs last history entry ...
        // }
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
