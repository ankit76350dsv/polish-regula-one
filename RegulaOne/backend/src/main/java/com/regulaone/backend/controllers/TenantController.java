package com.regulaone.backend.controllers;

import com.regulaone.backend.dto.Tenant.TenantPageResponse;
import com.regulaone.backend.dto.Tenant.TenantRequest;
import com.regulaone.backend.dto.Tenant.TenantResponse;
import com.regulaone.backend.models.TenantStatus;
import com.regulaone.backend.services.TenantService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

/**
 * REST controller for Tenant management.
 *
 * Route: /api/tenants
 *
 * Access control:
 *   - GET  endpoints → any authenticated user (ROLE_USER or ROLE_ADMIN)
 *   - POST / PUT / DELETE → ROLE_ADMIN only
 *
 * This is separate from /api/admin so that tenants can eventually
 * be read by regular users (e.g. for profile/settings pages),
 * while mutations remain admin-only.
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TenantController {

    private final TenantService tenantService;

    // ── Create ────────────────────────────────────────────────────────────────

    /**
     * POST /api/tenants
     * Creates a new Tenant. Returns 201 Created with the created resource URI in Location header.
     */
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    @PostMapping("/superadmin/tenant")
    public ResponseEntity<TenantResponse> createTenant(@Valid @RequestBody TenantRequest request) {
        TenantResponse created = tenantService.createTenant(request);

        // Return 201 Created with Location header pointing to the new resource
        URI location = URI.create("/api/tenants/" + created.getId());
        return ResponseEntity.created(location).body(created);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    /**
     * PUT /api/tenants/{id}
     * Fully replaces a Tenant's data. Returns 200 with the updated resource.
     */
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    @PutMapping("/superadmin/tenant/{id}")
    public ResponseEntity<TenantResponse> updateTenant(
            @PathVariable String id,
            @Valid @RequestBody TenantRequest request) {
        return ResponseEntity.ok(tenantService.updateTenant(id, request));
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    /**
     * DELETE /api/tenants/{id}
     * Permanently removes a Tenant. Returns 204 No Content on success.
     */
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    @DeleteMapping("/superadmin/tenant/{id}")
    public ResponseEntity<Void> deleteTenant(@PathVariable String id) {
        tenantService.deleteTenant(id);
        return ResponseEntity.noContent().build();
    }

    // ── Read ──────────────────────────────────────────────────────────────────
    @GetMapping("/superadmin/tenants")
    public ResponseEntity<TenantPageResponse> getAllTenants(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) TenantStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {

        // Cap page size at 100 to avoid accidentally returning the entire collection
        int safeSize = Math.min(size, 100);

        // Build sort direction from the string param
        Sort.Direction direction = sortDir.equalsIgnoreCase("asc")
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;

        Pageable pageable = PageRequest.of(page, safeSize, Sort.by(direction, sortBy));

        return ResponseEntity.ok(tenantService.getAllTenants(search, status, pageable));
    }

     /**
     * GET /api/tenants/{id}
     * Returns a single Tenant by its MongoDB ID. Returns 404 if not found.
     */
    @PreAuthorize("isAuthenticated()")
    @GetMapping("/tenant/{id}")
    public ResponseEntity<TenantResponse> getTenantById(@PathVariable String id) {
        return ResponseEntity.ok(tenantService.getTenantById(id));
    }
}
