package com.regulaone.backend.services;

import com.regulaone.backend.dto.Package.PackagePageResponse;
import com.regulaone.backend.dto.Package.PackageRequest;
import com.regulaone.backend.dto.Package.PackageResponse;
import com.regulaone.backend.dto.Package.TenantPackagesResponse;
// OLD: TenantPackageResponse removed — assignPackageToTenant now returns TenantResponse (full tenant with package embedded)
// import com.regulaone.backend.dto.Package.TenantPackageResponse;
import com.regulaone.backend.dto.Tenant.TenantResponse;
import com.regulaone.backend.models.AppPackage;
import com.regulaone.backend.models.PackageStatus;
// OLD: TenantModule and TenantPackage removed — syncTenantModules() removed in favour of @DBRef approach
// import com.regulaone.backend.models.TenantModule;
// import com.regulaone.backend.models.TenantPackage;
import com.regulaone.backend.models.Tenant;
import com.regulaone.backend.repository.PackageRepository;
// OLD: TenantPackageRepository removed — package assignment now stored directly on Tenant via @DBRef
// import com.regulaone.backend.repository.TenantPackageRepository;
import com.regulaone.backend.repository.TenantRepository;
import com.regulaone.backend.utils.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PackageService {

    private final PackageRepository packageRepository;
    // OLD: TenantPackageRepository removed — package assignment is now stored directly on Tenant via @DBRef
    // private final TenantPackageRepository tenantPackageRepository;
    private final TenantRepository tenantRepository;

    // ── Package CRUD ──────────────────────────────────────────────────────────

    /**
     * //? Creates a new AppPackage after validating name uniqueness and date order.
     */
    public PackageResponse createPackage(PackageRequest request) {

        validateNameUniqueness(request.getName(), null);

        // ! expire-date select from the frontend calculate in the frontend
        // if from the caledar date will be selected then the send it
        // if the monthly or year selcted then calalcyut in the fronted and send it to
        // backend means here
        validateDates(LocalDateTime.now(), request.getExpiringDate());

        AppPackage pkg = AppPackage.builder()
                .name(request.getName())
                .description(request.getDescription())
                .price(request.getPrice())
                .currency(request.getCurrency().toUpperCase())
                .durationType(request.getDurationType())
                .appIds(request.getAppIds())
                .status(request.getStatus() != null ? request.getStatus() : PackageStatus.ACTIVE)
                .startingDate(LocalDateTime.now())
                .expiringDate(request.getExpiringDate())
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

        // If startingDate not provided
        LocalDateTime effectiveStart = request.getStartingDate() != null
                ? request.getStartingDate()
                : LocalDateTime.now();

        validateDates(effectiveStart, request.getExpiringDate());

        pkg.setName(request.getName());
        pkg.setDescription(request.getDescription());
        pkg.setPrice(request.getPrice());
        pkg.setCurrency(request.getCurrency().toUpperCase());
        pkg.setDurationType(request.getDurationType());
        pkg.setAppIds(request.getAppIds());
        pkg.setStatus(request.getStatus() != null ? request.getStatus() : pkg.getStatus());
        pkg.setStartingDate(effectiveStart);
        pkg.setExpiringDate(request.getExpiringDate());
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
        List<Tenant> affectedTenants = tenantRepository.findByCurrentPackageId(id);
        
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

    // ── Tenant–Package Assignment ─────────────────────────────────────────────
    /**
     * Assigns an AppPackage to a Tenant using @DBRef (new approach).
     *
     * Steps:
     * 1. Validate both tenant and package exist
     * 2. Prevent assigning the same package that is already active
     * 3. Move the current package to packageHistory (if not already there)
     * 4. Set the new package as currentPackage and save the tenant
     *
     *
     * @param tenantId   MongoDB ID of the Tenant
     * @param packageId  MongoDB ID of the AppPackage
     * @param assignedBy Cognito sub of the super admin (kept for audit logging if needed later)
     */
    public TenantResponse assignPackageToTenant(String tenantId, String packageId, String assignedBy) {
        
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant not found with id: " + tenantId));

        AppPackage pkg = packageRepository.findById(packageId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Package not found with id: " + packageId));

        // Prevent re-assigning the package that is already active
        if (tenant.getCurrentPackage() != null
                && tenant.getCurrentPackage().getId().equals(packageId)) {
            throw new IllegalArgumentException(
                    "Package '" + pkg.getName() + "' is already the active package for this tenant");
        }

        // Move the current active package to history before replacing it.
        // Guard against duplicates in history (e.g., if the same package was active before).
        if (tenant.getCurrentPackage() != null) {
            String currentId = tenant.getCurrentPackage().getId();
            boolean alreadyInHistory = tenant.getPackageHistory().stream()
                    .anyMatch(p -> p.getId().equals(currentId));
            if (!alreadyInHistory) {
                tenant.getPackageHistory().add(tenant.getCurrentPackage());
            }
        }

        tenant.setCurrentPackage(pkg);
        tenant.setUpdatedAt(LocalDateTime.now());

        return TenantResponse.from(tenantRepository.save(tenant));
    }

    /**
     * Removes the active package from a Tenant.
     *
     * Verifies that the given packageId matches the tenant's currentPackage before clearing it.
     * The removed package stays in packageHistory — history is never deleted.
     */
    public void removePackageFromTenant(String tenantId, String packageId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant not found with id: " + tenantId));

        // Confirm the given package is actually the one currently assigned
        if (tenant.getCurrentPackage() == null
                || !tenant.getCurrentPackage().getId().equals(packageId)) {
            throw new ResourceNotFoundException(
                    "Package '" + packageId + "' is not the active package for this tenant");
        }

        tenant.setCurrentPackage(null);
        tenant.setUpdatedAt(LocalDateTime.now());
        tenantRepository.save(tenant);
    }

    /**
     * Returns the current package and full package history for a tenant.
     *
     * NEW: reads directly from Tenant.currentPackage and Tenant.packageHistory (@DBRef).
     * No separate junction collection query needed.
     *
     */
    public TenantPackagesResponse getPackagesForTenant(String tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Tenant not found with id: " + tenantId));

        PackageResponse current = tenant.getCurrentPackage() != null
                ? PackageResponse.from(tenant.getCurrentPackage())
                : null;

        List<PackageResponse> history = tenant.getPackageHistory() != null
                ? tenant.getPackageHistory().stream()
                        .map(PackageResponse::from)
                        .collect(Collectors.toList())
                : List.of();

        return TenantPackagesResponse.builder()
                .tenantId(tenantId)
                .currentPackage(current)
                .packageHistory(history)
                .build();
    }

    // ── Private Helpers ───────────────────────────────────────────────────────

    // OLD: syncTenantModules() removed — app access is now derived from Tenant.currentPackage.appIds
    // at query time, so there is no denormalized list to keep in sync.
    // private void syncTenantModules(String tenantId) { ... }

    /**
     * Validates that expiringDate is strictly after startingDate.
     * Called on both create and update to enforce date order.
     */
    private void validateDates(LocalDateTime startingDate, LocalDateTime expiringDate) {
        if (!expiringDate.isAfter(startingDate)) {
            throw new IllegalArgumentException(
                    "expiringDate must be after startingDate");
        }
    }

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
