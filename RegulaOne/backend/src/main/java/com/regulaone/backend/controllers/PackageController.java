package com.regulaone.backend.controllers;

import com.regulaone.backend.dto.Package.PackagePageResponse;
import com.regulaone.backend.dto.Package.PackageRequest;
import com.regulaone.backend.dto.Package.PackageResponse;
import com.regulaone.backend.dto.Package.TenantPackagesResponse;
// OLD: TenantPackageResponse replaced — assignPackage now returns TenantResponse; getPackagesForTenant returns TenantPackagesResponse
// import com.regulaone.backend.dto.Package.TenantPackageResponse;
import com.regulaone.backend.dto.Tenant.TenantResponse;
import com.regulaone.backend.models.PackageStatus;
import com.regulaone.backend.services.PackageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
// OLD: List import removed — getPackagesForTenant now returns TenantPackagesResponse (not a List)
// import java.util.List;

/**
 * REST controller for Package management and Tenant-Package assignments.
 *
 * All endpoints are under /api/superadmin and require ROLE_SUPER_ADMIN.
 *
 * Package CRUD:
 *   POST   /api/superadmin/packages
 *   PUT    /api/superadmin/packages/{id}
 *   DELETE /api/superadmin/packages/{id}
 *   GET    /api/superadmin/packages/{id}
 *   GET    /api/superadmin/packages?search=&status=&page=&size=&sortBy=&sortDir=
 *
 * Tenant–Package assignment:
 *   POST   /api/superadmin/tenants/{tenantId}/packages/{packageId}
 *   DELETE /api/superadmin/tenants/{tenantId}/packages/{packageId}
 *   GET    /api/superadmin/tenants/{tenantId}/packages
 */
@RestController
@RequestMapping("/api/superadmin")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
@Tag(name = "Package Management", description = "APIs for managing subscription packages and tenant app access")
public class PackageController {

    private final PackageService packageService;

    // ── Package CRUD ──────────────────────────────────────────────────────────

    @Operation(summary = "Create a new subscription package")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Package created successfully"),
        @ApiResponse(responseCode = "400", description = "Validation error or duplicate package name"),
        @ApiResponse(responseCode = "403", description = "Requires ROLE_SUPER_ADMIN")
    })

    //!create
    @PostMapping("/packages")
    public ResponseEntity<PackageResponse> createPackage(@Valid @RequestBody PackageRequest request) {
       
        PackageResponse created = packageService.createPackage(request);

        // Return 201 Created with Location header pointing to the new resource
        URI location = URI.create("/api/superadmin/packages/" + created.getId());
        return ResponseEntity.created(location).body(created);
    }

    //! update
    @Operation(summary = "Update an existing package by ID")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Package updated successfully"),
        @ApiResponse(responseCode = "400", description = "Validation error or duplicate package name"),
        @ApiResponse(responseCode = "404", description = "Package not found")
    })
    @PutMapping("/packages/{id}")
    public ResponseEntity<PackageResponse> updatePackage(
            @PathVariable String id,
            @Valid @RequestBody PackageRequest request) {
        return ResponseEntity.ok(packageService.updatePackage(id, request));
    }

    //!delete
    @Operation(summary = "Delete a package by ID — also removes all tenant assignments")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Package deleted"),
        @ApiResponse(responseCode = "404", description = "Package not found")
    })
    @DeleteMapping("/packages/{id}")
    public ResponseEntity<Void> deletePackage(@PathVariable String id) {
        packageService.deletePackage(id);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Get a single package by ID")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Package found"),
        @ApiResponse(responseCode = "404", description = "Package not found")
    })
    @GetMapping("/packages/{id}")
    public ResponseEntity<PackageResponse> getPackageById(@PathVariable String id) {
        return ResponseEntity.ok(packageService.getPackageById(id));
    }

    /**
     * GET /api/superadmin/packages
     *
     * Paginated package list with optional filters.
     *
     * Query params:
     *   search  — partial name match (case-insensitive)
     *   status  — ACTIVE / INACTIVE / EXPIRED
     *   page    — zero-based index (default 0)
     *   size    — items per page (default 10, max 100)
     *   sortBy  — field to sort by (default: createdAt)
     *   sortDir — asc or desc (default: desc)
     *
     * Example: GET /api/superadmin/packages?search=basic&status=ACTIVE&page=0&size=5
     */
    @Operation(summary = "Get all packages with pagination, search, and status filter")
    @GetMapping("/packages")
    public ResponseEntity<PackagePageResponse> getAllPackages(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) PackageStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {

        // Cap at 100 to prevent accidentally dumping the entire collection
        int safeSize = Math.min(size, 100);

        Sort.Direction direction = sortDir.equalsIgnoreCase("asc")
                ? Sort.Direction.ASC : Sort.Direction.DESC;

        Pageable pageable = PageRequest.of(page, safeSize, Sort.by(direction, sortBy));

        return ResponseEntity.ok(packageService.getAllPackages(search, status, pageable));
    }

    // ── Tenant–Package Assignment ─────────────────────────────────────────────

    /**
     * POST /api/superadmin/tenants/{tenantId}/packages/{packageId}
     *
     * Assigns a package to a tenant. On success:
     *   - Creates a TenantPackage junction record
     *   - Re-syncs Tenant.enabledModules to include the new package's apps
     *
     * @param jwt injected by Spring Security — used to record who performed the assignment
     */
    @Operation(summary = "Assign a package to a tenant")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Package assigned successfully"),
        @ApiResponse(responseCode = "400", description = "Package already assigned to this tenant"),
        @ApiResponse(responseCode = "404", description = "Tenant or package not found")
    })
    @PostMapping("/tenants/{tenantId}/packages/{packageId}")
    public ResponseEntity<TenantResponse> assignPackage(
            @PathVariable String tenantId,
            @PathVariable String packageId,
            @AuthenticationPrincipal Jwt jwt) {

        // Record the super admin's identity for audit purposes
        String assignedBy = jwt.getSubject();

        return ResponseEntity.ok(
                packageService.assignPackageToTenant(tenantId, packageId, assignedBy));
    }

    /**
     * DELETE /api/superadmin/tenants/{tenantId}/packages/{packageId}
     *
     * Removes a package from a tenant. On success:
     *   - Deletes the TenantPackage junction record
     *   - Re-syncs Tenant.enabledModules (apps only from this package are removed)
     */
    @Operation(summary = "Remove a package from a tenant")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Package removed from tenant"),
        @ApiResponse(responseCode = "404", description = "Tenant, package, or assignment not found")
    })
    @DeleteMapping("/tenants/{tenantId}/packages/{packageId}")
    public ResponseEntity<Void> removePackage(
            @PathVariable String tenantId,
            @PathVariable String packageId) {
        packageService.removePackageFromTenant(tenantId, packageId);
        return ResponseEntity.noContent().build();
    }

    /**
     * GET /api/superadmin/tenants/{tenantId}/packages
     *
     * Returns all packages assigned to a tenant with full package details embedded.
     */
    @Operation(summary = "Get current package and package history for a specific tenant")
    @ApiResponse(responseCode = "404", description = "Tenant not found")
    @GetMapping("/tenants/{tenantId}/packages")
    public ResponseEntity<TenantPackagesResponse> getPackagesForTenant(
            @PathVariable String tenantId) {
        return ResponseEntity.ok(packageService.getPackagesForTenant(tenantId));
    }
}
