package com.regulaone.backend.billing;

import com.regulaone.backend.billing.dto.AdminPackageResponse;
import com.regulaone.backend.billing.dto.InvoiceResponse;
import com.regulaone.backend.billing.dto.PackageChangeResponse;
import com.regulaone.backend.billing.dto.PackagePageResponse;
import com.regulaone.backend.billing.dto.PackageRenewalResponse;
import com.regulaone.backend.billing.dto.PackageRequest;
import com.regulaone.backend.billing.dto.PackageResponse;
import com.regulaone.backend.billing.dto.PackageTierStatsResponse;
import com.regulaone.backend.billing.dto.RenewPackageRequest;
import com.regulaone.backend.billing.dto.TierChangeResponse;
import com.regulaone.backend.billing.dto.UpgradePackageRequest;
import com.regulaone.backend.common.AppResponse;
import com.regulaone.backend.common.PageRequests;
import com.regulaone.backend.models.PackageStatus;
import com.regulaone.backend.user.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Plans, subscriptions and invoices — the money side of RegulaOne.
 *
 * ── TWO AUDIENCES, ONE SUBJECT ──────────────────────────────────────────────────
 *
 * THE PLATFORM OPERATOR (ROLE_SUPER_ADMIN), under /api/superadmin — runs the catalogue
 * and moves customers between plans:
 *   POST   /packages                              add a plan
 *   PUT    /packages/{id}                         edit a plan
 *   DELETE /packages/{id}                         retire a plan
 *   GET    /packages/{id}                         one plan
 *   GET    /packages                              the catalogue, paged and searchable
 *   GET    /packages/tier-stats                   how each tier is performing
 *   GET    /tier-changes                          who moved plan, and when
 *   GET    /tier-changes/export                   the same, as a CSV file
 *   POST   /tenants/{tenantId}/package/renew      another period on the same plan
 *   POST   /tenants/{tenantId}/package/upgrade    move to a different plan
 *
 * A COMPANY ADMINISTRATOR (ROLE_ADMIN), under /api/admin — sees only their own company:
 *   GET    /packages                              the plans they could buy
 *   GET    /billing                               their own invoices
 *
 * WHY BOTH SETS LIVE HERE
 *   They are one subject seen from two sides, and they read the same three services. The
 *   two company-admin endpoints used to sit in a general-purpose "admin" controller
 *   alongside user management, so billing was described in two places at once. No URL
 *   changed in the move.
 *
 * SECURITY: because the two audiences differ, this class carries NO class-level
 * {@code @PreAuthorize}. EVERY method states its own rule, and SecurityConfig's URL rules
 * for /api/admin/** and /api/superadmin/** remain a second line of defence.
 */
@RestController
@RequiredArgsConstructor
public class SubscriptionController {

    private final PackageService packageService;
    private final SubscriptionService subscriptionService;
    private final BillingService billingService;

    // Used only to resolve WHICH company the signed-in administrator belongs to.
    private final UserService userService;

    // ══ Platform operator: the plan catalogue ═════════════════════════════════

    @PostMapping("/api/superadmin/packages")
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    public ResponseEntity<AppResponse<PackageResponse>> createPackage(
            @Valid @RequestBody PackageRequest request) {
        PackageResponse created = packageService.createPackage(request);
        return ResponseEntity.status(201)
                .body(AppResponse.created("Package created successfully", created));
    }

    @PutMapping("/api/superadmin/packages/{id}")
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    public ResponseEntity<AppResponse<PackageResponse>> updatePackage(
            @PathVariable String id,
            @Valid @RequestBody PackageRequest request) {
        return ResponseEntity.ok(AppResponse.success(
                "Package updated successfully",
                packageService.updatePackage(id, request)));
    }

    @DeleteMapping("/api/superadmin/packages/{id}")
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    public ResponseEntity<AppResponse<Void>> deletePackage(@PathVariable String id) {
        packageService.deletePackage(id);
        return ResponseEntity.ok(AppResponse.success("Package deleted successfully."));
    }

    @GetMapping("/api/superadmin/packages/{id}")
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    public ResponseEntity<AppResponse<PackageResponse>> getPackageById(@PathVariable String id) {
        return ResponseEntity.ok(AppResponse.success(
                "Package loaded",
                packageService.getPackageById(id)));
    }

    /**
     * The catalogue, paged.
     *
     * The page size is capped inside {@link PageRequests}, so no single request can pull
     * the whole collection at once.
     */
    @GetMapping("/api/superadmin/packages")
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    public ResponseEntity<AppResponse<PackagePageResponse>> getAllPackages(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) PackageStatus status,
            @RequestParam(defaultValue = "0")    int page,
            @RequestParam(defaultValue = "10")   int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {

        return ResponseEntity.ok(AppResponse.success(
                "Packages loaded",
                packageService.getAllPackages(search, status,
                        PageRequests.of(page, size, sortBy, sortDir))));
    }

    @GetMapping("/api/superadmin/packages/tier-stats")
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    public ResponseEntity<AppResponse<PackageTierStatsResponse>> getPackageTierStats() {
        return ResponseEntity.ok(AppResponse.success(
                "Tier stats loaded",
                packageService.getPackageTierStats()));
    }

    // ══ Platform operator: customer subscriptions ══════════════════════════════

    /**
     * Renews a tenant's CURRENT package for another billing period.
     *
     * Extends the validity window (stacked on the current expiry if the plan is still
     * valid), records the period in the plan history, and generates a renewal invoice.
     * The body is optional — only an audit reason may be supplied.
     */
    @PostMapping("/api/superadmin/tenants/{tenantId}/package/renew")
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    public ResponseEntity<AppResponse<PackageRenewalResponse>> renewTenantPackage(
            @PathVariable String tenantId,
            @Valid @RequestBody(required = false) RenewPackageRequest request) {
        return ResponseEntity.ok(AppResponse.success(
                "Package renewed successfully",
                subscriptionService.renewTenantPackage(tenantId, request)));
    }

    /**
     * Moves a tenant to a DIFFERENT package tier.
     *
     * Ends the current plan now, starts a fresh window on the new one, and generates an
     * invoice. The body must supply the target packageId.
     */
    @PostMapping("/api/superadmin/tenants/{tenantId}/package/upgrade")
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    public ResponseEntity<AppResponse<PackageChangeResponse>> upgradeTenantPackage(
            @PathVariable String tenantId,
            @Valid @RequestBody UpgradePackageRequest request) {
        return ResponseEntity.ok(AppResponse.success(
                "Package upgraded successfully",
                subscriptionService.upgradeTenantPackage(tenantId, request)));
    }

    // ══ Platform operator: plan-assignment history ═════════════════════════════

    @GetMapping("/api/superadmin/tier-changes")
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    public ResponseEntity<AppResponse<List<TierChangeResponse>>> getTierChanges(
            @RequestParam(required = false) Integer limit) {
        return ResponseEntity.ok(AppResponse.success(
                "Tier changes loaded",
                subscriptionService.getTierChanges(limit)));
    }

    /** The same information as a CSV download; the headers below make the browser save it. */
    @GetMapping("/api/superadmin/tier-changes/export")
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    public ResponseEntity<String> exportBillingCsv() {
        String csv = subscriptionService.exportBillingCsv();
        return ResponseEntity.ok()
                .header("Content-Type", "text/csv; charset=UTF-8")
                .header("Content-Disposition", "attachment; filename=\"billing-export.csv\"")
                .body(csv);
    }

    // ══ Company administrator: their own plan and invoices ════════════════════

    /** The plans this company could buy, cheapest first — the "My Plan" comparison. */
    @GetMapping("/api/admin/packages")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<AppResponse<List<AdminPackageResponse>>> getActivePackages() {
        return ResponseEntity.ok(AppResponse.success(
                "Available packages loaded",
                packageService.getActivePackages()));
    }

    /**
     * This company's own invoices, newest first.
     *
     * The company is taken from the signed-in administrator's own record, never from the
     * request, so one customer can never read another's billing history.
     */
    @GetMapping("/api/admin/billing")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<AppResponse<List<InvoiceResponse>>> getBillingHistory(
            @AuthenticationPrincipal Jwt jwt) {
        String tenantId = userService.currentTenantId(jwt.getSubject());
        return ResponseEntity.ok(AppResponse.success(
                "Billing history loaded",
                billingService.getTenantInvoices(tenantId)));
    }
}
