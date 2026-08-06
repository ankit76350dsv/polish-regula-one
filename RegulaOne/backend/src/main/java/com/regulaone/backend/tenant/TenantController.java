package com.regulaone.backend.tenant;

import com.regulaone.backend.common.AppResponse;
import com.regulaone.backend.common.PageRequests;
import com.regulaone.backend.models.TenantStatus;
import com.regulaone.backend.tenant.dto.ChangeStatusRequest;
import com.regulaone.backend.tenant.dto.MyTenantResponse;
import com.regulaone.backend.tenant.dto.TenantPageResponse;
import com.regulaone.backend.tenant.dto.TenantRequest;
import com.regulaone.backend.tenant.dto.TenantResponse;
import com.regulaone.backend.tenant.dto.UpdateOrgRequest;
import com.regulaone.backend.user.UserService;
import com.regulaone.backend.user.dto.UserResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * THE ORGANISATION (tenant) — everything about a customer company.
 *
 * ── THREE AUDIENCES ─────────────────────────────────────────────────────────────
 *
 * THE PLATFORM OPERATOR (ROLE_SUPER_ADMIN) manages any company:
 *   POST   /api/superadmin/tenant                create
 *   PUT    /api/superadmin/tenant/{id}           replace its details
 *   PATCH  /api/superadmin/tenant/{id}/status    activate / suspend
 *   DELETE /api/superadmin/tenant/{id}           remove
 *   GET    /api/superadmin/tenants               list, paged and searchable
 *
 * A COMPANY ADMINISTRATOR (ROLE_ADMIN) manages their OWN company:
 *   POST   /api/admin/org/setup                  first-time setup, with a starter plan
 *   PUT    /api/admin/org                        edit contact and address details
 *
 * ANY SIGNED-IN MEMBER reads their own company:
 *   GET    /api/tenant/info                      the lean view for the app header
 *
 * ── SECURITY ────────────────────────────────────────────────────────────────────
 *
 * Three audiences means no single class-level rule can be right, so — as this controller
 * has always done — EVERY method carries its own {@code @PreAuthorize}, and SecurityConfig's
 * URL rules for /api/admin/** and /api/superadmin/** are a second line of defence.
 *
 * For the two self-service routes the company is taken from the signed-in user's own
 * record, never from the URL or body, so an administrator can only ever act on their own
 * organisation.
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TenantController {

    private final TenantService tenantService;
    private final OrganisationService organisationService;

    // Used only to resolve WHICH company the signed-in person belongs to.
    private final UserService userService;

    // ══ Platform operator ══════════════════════════════════════════════════════

    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    @PostMapping("/superadmin/tenant")
    public ResponseEntity<AppResponse<TenantResponse>> createTenant(
            @Valid @RequestBody TenantRequest request) {
        TenantResponse created = tenantService.createTenant(request);
        return ResponseEntity.status(201)
                .body(AppResponse.created("Tenant created successfully", created));
    }

    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    @PutMapping("/superadmin/tenant/{id}")
    public ResponseEntity<AppResponse<TenantResponse>> updateTenant(
            @PathVariable String id,
            @Valid @RequestBody TenantRequest request) {
        return ResponseEntity.ok(AppResponse.success(
                "Tenant updated successfully",
                tenantService.updateTenant(id, request)));
    }

    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    @PatchMapping("/superadmin/tenant/{id}/status")
    public ResponseEntity<AppResponse<TenantResponse>> changeStatus(
            @PathVariable String id,
            @Valid @RequestBody ChangeStatusRequest request) {
        return ResponseEntity.ok(AppResponse.success(
                "Tenant status updated successfully",
                tenantService.changeStatus(id, request.getStatus())));
    }

    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    @DeleteMapping("/superadmin/tenant/{id}")
    public ResponseEntity<AppResponse<Void>> deleteTenant(@PathVariable String id) {
        tenantService.deleteTenant(id);
        return ResponseEntity.ok(AppResponse.success("Tenant deleted successfully."));
    }

    /**
     * Every customer company, paged.
     *
     * Authorisation for this one route comes from SecurityConfig's /api/superadmin/**
     * rule (ROLE_SUPER_ADMIN) rather than an annotation here. That is how it has always
     * been, and it is left as it is so the endpoint's behaviour is provably unchanged.
     * The page size is capped inside {@link PageRequests}.
     */
    @GetMapping("/superadmin/tenants")
    public ResponseEntity<AppResponse<TenantPageResponse>> getAllTenants(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) TenantStatus status,
            @RequestParam(defaultValue = "0")    int page,
            @RequestParam(defaultValue = "10")   int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {

        return ResponseEntity.ok(AppResponse.success(
                "Tenants loaded",
                tenantService.getAllTenants(search, status,
                        PageRequests.of(page, size, sortBy, sortDir))));
    }

    // ══ Company administrator: my own organisation ════════════════════════════

    /**
     * FIRST-TIME SETUP. Creates the administrator's company, puts it on the starter plan
     * and links the two, so the frontend can close its setup modal and unlock the app.
     */
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    @PostMapping("/admin/org/setup")
    public ResponseEntity<AppResponse<UserResponse>> setupOrganisation(
            @Valid @RequestBody TenantRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(AppResponse.success(
                "Organisation created successfully",
                organisationService.setupOrganisation(jwt.getSubject(), request)));
    }

    /**
     * Edit my own company's contact and address details.
     *
     * NIP, REGON and account status are deliberately not editable here — they are the
     * company's legal identity and appear on invoices and government filings, so changing
     * them is a platform-operator action.
     */
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    @PutMapping("/admin/org")
    public ResponseEntity<AppResponse<TenantResponse>> updateMyOrg(
            @Valid @RequestBody UpdateOrgRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(AppResponse.success(
                "Organisation details updated successfully",
                organisationService.updateMyOrg(jwt.getSubject(), request)));
    }

    // ══ Any signed-in member ═══════════════════════════════════════════════════

    /**
     * The organisation of the currently authenticated user.
     *
     * The company id is derived from the JWT subject (never trusted from the client), so a
     * user can only ever load their own organisation — enforcing tenant isolation.
     */
    @PreAuthorize("isAuthenticated()")
    @GetMapping("/tenant/info")
    public ResponseEntity<AppResponse<MyTenantResponse>> getMyTenant(
            @AuthenticationPrincipal Jwt jwt) {
        String tenantId = userService.currentTenantId(jwt.getSubject());
        return ResponseEntity.ok(AppResponse.success(
                "Tenant loaded",
                tenantService.getMyTenantInfo(tenantId)));
    }
}
