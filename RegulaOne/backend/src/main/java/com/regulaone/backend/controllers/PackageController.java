package com.regulaone.backend.controllers;

import com.regulaone.backend.dto.AppResponse;
import com.regulaone.backend.dto.Package.PackagePageResponse;
import com.regulaone.backend.dto.Package.PackageRenewalResponse;
import com.regulaone.backend.dto.Package.PackageRequest;
import com.regulaone.backend.dto.Package.PackageResponse;
import com.regulaone.backend.dto.Package.PackageTierStatsResponse;
import com.regulaone.backend.dto.Package.RenewPackageRequest;
import com.regulaone.backend.dto.Package.TierChangeResponse;
import com.regulaone.backend.models.PackageStatus;
import com.regulaone.backend.services.PackageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/superadmin")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
public class PackageController {

    private final PackageService packageService;

    // ── Package CRUD ──────────────────────────────────────────────────────────

    @PostMapping("/packages")
    public ResponseEntity<AppResponse<PackageResponse>> createPackage(
            @Valid @RequestBody PackageRequest request) {
        PackageResponse created = packageService.createPackage(request);
        return ResponseEntity.status(201)
                .body(AppResponse.created("Package created successfully", created));
    }

    @PutMapping("/packages/{id}")
    public ResponseEntity<AppResponse<PackageResponse>> updatePackage(
            @PathVariable String id,
            @Valid @RequestBody PackageRequest request) {
        return ResponseEntity.ok(AppResponse.success(
                "Package updated successfully",
                packageService.updatePackage(id, request)));
    }

    @DeleteMapping("/packages/{id}")
    public ResponseEntity<AppResponse<Void>> deletePackage(@PathVariable String id) {
        packageService.deletePackage(id);
        return ResponseEntity.ok(AppResponse.success("Package deleted successfully."));
    }

    @GetMapping("/packages/{id}")
    public ResponseEntity<AppResponse<PackageResponse>> getPackageById(@PathVariable String id) {
        return ResponseEntity.ok(AppResponse.success(
                "Package loaded",
                packageService.getPackageById(id)));
    }

    @GetMapping("/packages")
    public ResponseEntity<AppResponse<PackagePageResponse>> getAllPackages(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) PackageStatus status,
            @RequestParam(defaultValue = "0")    int page,
            @RequestParam(defaultValue = "10")   int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {

        int safeSize = Math.min(size, 100);
        Sort.Direction direction = sortDir.equalsIgnoreCase("asc")
                ? Sort.Direction.ASC : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(page, safeSize, Sort.by(direction, sortBy));

        return ResponseEntity.ok(AppResponse.success(
                "Packages loaded",
                packageService.getAllPackages(search, status, pageable)));
    }

    // ── Package renewal ───────────────────────────────────────────────────────

    // Renews a tenant's CURRENT package for another billing period.
    // Extends the validity window (stacked on the current expiry if still valid),
    // records a history entry, and generates a renewal invoice.
    // Body is optional — only an audit reason may be supplied.
    @PostMapping("/tenants/{tenantId}/package/renew")
    public ResponseEntity<AppResponse<PackageRenewalResponse>> renewTenantPackage(
            @PathVariable String tenantId,
            @Valid @RequestBody(required = false) RenewPackageRequest request) {
        return ResponseEntity.ok(AppResponse.success(
                "Package renewed successfully",
                packageService.renewTenantPackage(tenantId, request)));
    }

    // ── License Tiers dashboard ───────────────────────────────────────────────

    @GetMapping("/packages/tier-stats")
    public ResponseEntity<AppResponse<PackageTierStatsResponse>> getPackageTierStats() {
        return ResponseEntity.ok(AppResponse.success(
                "Tier stats loaded",
                packageService.getPackageTierStats()));
    }

    @GetMapping("/tier-changes")
    public ResponseEntity<AppResponse<List<TierChangeResponse>>> getTierChanges(
            @RequestParam(required = false) Integer limit) {
        return ResponseEntity.ok(AppResponse.success(
                "Tier changes loaded",
                packageService.getTierChanges(limit)));
    }

    @GetMapping("/tier-changes/export")
    public ResponseEntity<String> exportBillingCsv() {
        String csv = packageService.exportBillingCsv();
        return ResponseEntity.ok()
                .header("Content-Type", "text/csv; charset=UTF-8")
                .header("Content-Disposition", "attachment; filename=\"billing-export.csv\"")
                .body(csv);
    }
}
