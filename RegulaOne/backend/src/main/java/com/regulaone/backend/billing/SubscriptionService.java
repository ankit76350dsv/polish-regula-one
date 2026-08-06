package com.regulaone.backend.billing;

import com.regulaone.backend.billing.dto.PackageChangeResponse;
import com.regulaone.backend.billing.dto.PackageRenewalResponse;
import com.regulaone.backend.billing.dto.RenewPackageRequest;
import com.regulaone.backend.billing.dto.TierChangeResponse;
import com.regulaone.backend.billing.dto.UpgradePackageRequest;
import com.regulaone.backend.common.ResourceNotFoundException;
import com.regulaone.backend.models.AppPackage;
import com.regulaone.backend.models.DurationType;
import com.regulaone.backend.models.Invoice;
import com.regulaone.backend.models.PackageStatus;
import com.regulaone.backend.models.Tenant;
import com.regulaone.backend.tenant.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * WHAT EACH CUSTOMER IS SUBSCRIBED TO, and how that changes over time: renewals, plan
 * changes, and the history those produce.
 *
 * It is the counterpart of {@link PackageService}, which owns the plan CATALOGUE (what
 * is for sale). This class owns the ASSIGNMENT of a plan to a company, so the two
 * questions "what plans exist?" and "what is this customer on?" no longer live in one
 * 700-line class.
 *
 * ── THE PLAN-HISTORY LEDGER, AND WHY IT MATTERS ─────────────────────────────────
 *
 * {@code tenant.packageHistory} is not a log — it is the billing ledger the revenue
 * report reads. The rules it follows are:
 *
 *   * ONE ENTRY PER PAID PERIOD THAT STARTS, stamped with the date it started. A renewal
 *     therefore ADDS an entry; it never edits the previous one, because the platform
 *     revenue chart counts one entry per period.
 *   * WHEN A PERIOD ENDS EARLY (a plan change, or the plan being withdrawn), the matching
 *     entry gets its {@code planExpired} filled in. The entry itself is never removed:
 *     an audit trail that can be rewritten is not an audit trail.
 *
 * Renewal and plan change differ in exactly one way, and it is a commercial decision, not
 * a technical one: a RENEWAL stacks the new period on top of the current expiry so no
 * paid-for time is lost, while a PLAN CHANGE starts a fresh period now and ends the old
 * one immediately.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class SubscriptionService {

    private final PackageRepository packageRepository;
    private final TenantRepository tenantRepository;
    private final BillingService billingService;

    // ── Renewal ───────────────────────────────────────────────────────────────

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
     *  4. Adds the new period to the plan-history ledger, with the supplied reason.
     *  5. Generates an invoice for the renewal (FREE if the package is no-charge,
     *     otherwise PAID) covering the exact new period.
     *
     * {@code @Transactional} so the tenant update and the invoice are consistent.
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
        LocalDateTime oldExpiring = current.getPlanExpiring();

        // Stack remaining time: extend from the current expiry if the plan is still
        // valid, otherwise start a fresh window from now.
        LocalDateTime baseDate = (oldExpiring != null && oldExpiring.isAfter(now)) ? oldExpiring : now;
        LocalDateTime newExpiring = baseDate.plusDays(pkg.getDuration());

        String reason = reasonOr(request != null ? request.getReason() : null, "Package renewal");

        // 1. Extend the active window — same tier, later expiry.
        current.setPlanStarted(baseDate);
        current.setPlanExpiring(newExpiring);

        // 2. Record the renewed period in the ledger. getTierChanges() skips the entry
        //    whose planStarted matches the live plan, so this does not double-show the
        //    current assignment.
        appendToLedger(tenant, pkg, baseDate, newExpiring, current.getUsersCapacity(), reason);

        tenant.setUpdatedAt(now);
        tenantRepository.save(tenant);

        // 3. Bill the renewal. Free packages produce a FREE (zero-amount) invoice.
        Invoice invoice = billingService.generateInvoice(tenant, pkg, isFree(pkg), baseDate, newExpiring);

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

    // ── Plan change (upgrade / downgrade) ─────────────────────────────────────

    /**
     * Moves a tenant to a DIFFERENT package tier.
     *
     * What it does, in order:
     *  1. Loads the tenant and the target package; 404 if either is missing.
     *  2. Blocks the change if the target package is not ACTIVE, or if it is the same
     *     package the tenant already has (renew is the right operation for that).
     *  3. Closes the outgoing period in the ledger (planExpired = now).
     *  4. Sets a fresh window for the NEW plan starting now (or open-ended for LIFETIME).
     *  5. Records the new period in the ledger and generates an invoice for it.
     *
     * Unlike renewal, this starts a brand-new period now — the old plan ends immediately,
     * so no time is carried over.
     *
     * {@code @Transactional} so the tenant update and the invoice stay consistent.
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

        String reason = reasonOr(request.getReason(), "Plan change to " + newPkg.getName());

        // 1. Mark the outgoing plan's period as ended in the ledger (audit only — its
        //    revenue was already counted at its start).
        if (current != null && current.getAppPackage() != null) {
            markCurrentPeriodEnded(tenant, current, now);
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

        // 3. Record the NEW paid period, so revenue is counted and the plan-assignment
        //    table shows the change.
        appendToLedger(tenant, newPkg, now, newExpiring, updated.getUsersCapacity(), reason);

        tenant.setUpdatedAt(now);
        tenantRepository.save(tenant);

        // 4. Bill the new plan. A LIFETIME plan has no expiry, so its first invoice covers
        //    one month rather than "for ever".
        LocalDateTime periodEnd = (newExpiring != null) ? newExpiring : now.plusMonths(1);
        Invoice invoice = billingService.generateInvoice(tenant, newPkg, isFree(newPkg), now, periodEnd);

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

    /**
     * Take a package away from every tenant currently on it, because it is being deleted
     * from the catalogue.
     *
     * Each affected tenant keeps its HISTORY — the closed period stays in the ledger, so
     * the trail still shows that the company had this plan and when it ended. Only the
     * live {@code currentPackage} is cleared.
     *
     * This also prevents a MappingException: Spring resolves {@code currentPackage} as a
     * @DBRef, and a reference to a deleted document would blow up on the next read.
     *
     * Called by {@link PackageService#deletePackage} — the catalogue asks the subscription
     * side to let go, rather than reaching into tenant documents itself.
     */
    void detachPackageFromTenants(String packageId) {
        List<Tenant> affectedTenants = tenantRepository.findByCurrentPackageAppPackageId(packageId);

        affectedTenants.forEach(tenant -> {
            LocalDateTime now = LocalDateTime.now();
            Tenant.PackageDetails current = tenant.getCurrentPackage();
            if (current != null && current.getAppPackage() != null) {
                markCurrentPeriodEnded(tenant, current, now);
            }
            tenant.setCurrentPackage(null);
            tenant.setUpdatedAt(now);
            tenantRepository.save(tenant);
        });
    }

    // ── History and export ────────────────────────────────────────────────────

    /**
     * Every package assignment across all tenants, newest first — the "Recent Plan
     * Assignments" table.
     *
     * Both the live plan and the historical entries are included, so a customer who has
     * only ever had ONE plan still appears (an earlier version compared consecutive
     * history entries and therefore showed nothing for them).
     *
     * The live plan is written to BOTH {@code currentPackage} and the ledger, so the
     * ledger entry with the same planStarted is skipped to avoid showing it twice.
     *
     * @param limit max results to return; null or 0 means return all
     */
    public List<TierChangeResponse> getTierChanges(Integer limit) {

        List<TierChangeResponse> assignments = new ArrayList<>();

        for (Tenant tenant : tenantRepository.findAll()) {

            LocalDateTime currentPlanStarted = null;

            // 1. The live assignment — always included; it is the one that carries an
            //    expiry date the table can show.
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

            // 2. Past assignments, skipping the duplicate of the live one.
            List<Tenant.PackageHistory> history = tenant.getPackageHistory();
            if (history != null) {
                for (Tenant.PackageHistory h : history) {
                    if (h.getAppPackage() == null) continue;

                    if (currentPlanStarted != null
                            && currentPlanStarted.equals(h.getPlanStarted())) {
                        continue;
                    }

                    assignments.add(TierChangeResponse.builder()
                            .tenantId(tenant.getId())
                            .tenantName(tenant.getName())
                            .toPlan(h.getAppPackage().getName())
                            .changedAt(h.getPlanStarted())
                            // planExpiring is not stored on PackageHistory (only planExpired
                            // is); left null for past entries — frontend renders "—".
                            .planExpiring(null)
                            .reason(h.getReason())
                            .build());
                }
            }
        }

        // Newest first, so callers do not have to sort themselves.
        assignments.sort(Comparator.comparing(TierChangeResponse::getChangedAt,
                Comparator.nullsLast(Comparator.reverseOrder())));

        if (limit != null && limit > 0 && assignments.size() > limit) {
            return assignments.subList(0, limit);
        }

        return assignments;
    }

    /**
     * A CSV of every tenant that currently has a plan.
     *
     * Columns: Tenant Name, NIP, Package, Price, Currency, Plan Started, Plan Expiring, Status
     *
     * The controller sets Content-Type: text/csv and Content-Disposition so the browser
     * saves it as a file.
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

    /** Doubles any quote inside a CSV value, so one field cannot break out into another. */
    private String escapeCsv(String value) {
        return value != null ? value.replace("\"", "\"\"") : "";
    }

    // ── Ledger helpers ────────────────────────────────────────────────────────

    /**
     * Add one paid period to the tenant's plan-history ledger.
     *
     * Creates the list first if a legacy document stored null, so appending can never hit
     * a NullPointerException.
     */
    private void appendToLedger(Tenant tenant,
                                AppPackage pkg,
                                LocalDateTime startedAt,
                                LocalDateTime endsAt,
                                String usersCapacity,
                                String reason) {
        if (tenant.getPackageHistory() == null) {
            tenant.setPackageHistory(new ArrayList<>());
        }
        tenant.getPackageHistory().add(Tenant.PackageHistory.builder()
                .appPackage(pkg)
                .planStarted(startedAt)
                .planExpired(endsAt)
                .usersCapacity(usersCapacity)
                .reason(reason)
                .build());
    }

    /**
     * Mark the ledger entry that represents the tenant's CURRENT period as ended, matched
     * by planStarted + package id.
     *
     * Used when a plan is replaced (a change) or withdrawn (catalogue deletion), so the
     * ledger records when the old period actually stopped. A safe no-op when no matching
     * entry exists, e.g. a legacy tenant with no ledger.
     */
    private void markCurrentPeriodEnded(Tenant tenant, Tenant.PackageDetails current, LocalDateTime endedAt) {
        if (tenant.getPackageHistory() == null
                || current == null
                || current.getPlanStarted() == null
                || current.getAppPackage() == null
                || current.getAppPackage().getId() == null) {
            return;
        }
        for (Tenant.PackageHistory h : tenant.getPackageHistory()) {
            if (h.getAppPackage() != null
                    && current.getPlanStarted().equals(h.getPlanStarted())
                    && current.getAppPackage().getId().equals(h.getAppPackage().getId())) {
                h.setPlanExpired(endedAt);
                return;
            }
        }
    }

    /** A no-cost plan still gets an invoice, but for zero — so the ledger stays complete. */
    private boolean isFree(AppPackage pkg) {
        return pkg.getPrice() == null || pkg.getPrice().compareTo(BigDecimal.ZERO) == 0;
    }

    /** The operator's audit reason, trimmed — or a sensible default when none was given. */
    private String reasonOr(String supplied, String fallback) {
        return (supplied != null && !supplied.isBlank()) ? supplied.trim() : fallback;
    }
}
