package com.regulaone.backend.services;

import com.regulaone.backend.dto.Package.PackagePageResponse;
import com.regulaone.backend.dto.Package.PackageRequest;
import com.regulaone.backend.dto.Package.PackageResponse;

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

import java.time.LocalDateTime;
import java.util.List;

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
