package com.regulaone.backend.services;

import com.regulaone.backend.dto.Tenant.TenantPageResponse;
import com.regulaone.backend.dto.Tenant.TenantRequest;
import com.regulaone.backend.dto.Tenant.TenantResponse;
import com.regulaone.backend.models.Tenant;
import com.regulaone.backend.models.TenantStatus;
import com.regulaone.backend.repository.TenantRepository;
import com.regulaone.backend.utils.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * Business logic layer for Tenant management.
 *
 * Responsibilities:
 *   - Enforce uniqueness rules (NIP and email must be unique across all tenants)
 *   - Map between DTOs and entities
 *   - Delegate persistence to TenantRepository
 *
 * Throws IllegalArgumentException for duplicate/conflict violations (→ 400)
 * Throws ResourceNotFoundException when a tenant is not found by ID (→ 404)
 */
@Service
@RequiredArgsConstructor
public class TenantService {

    private final TenantRepository tenantRepository;

    // ── Create ────────────────────────────────────────────────────────────────

    /**
     * Creates a new Tenant.
     * Validates that no existing tenant has the same NIP or email before saving.
     */
    public TenantResponse createTenant(TenantRequest request) {

        // NIP is a legally unique identifier in Poland — reject duplicates immediately
        if (tenantRepository.existsByNip(request.getNip())) {
            throw new IllegalArgumentException(
                    "A tenant with NIP " + request.getNip() + " already exists");
        }

        // Email must also be unique as it is used for platform notifications
        if (tenantRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException(
                    "A tenant with email " + request.getEmail() + " already exists");
        }

        Tenant tenant = Tenant.builder()
                .name(request.getName())
                .nip(request.getNip())
                .regon(request.getRegon())
                .email(request.getEmail())
                .phone(request.getPhone())
                .address(request.getAddress())
                .city(request.getCity())
                .postalCode(request.getPostalCode())
                .status(request.getStatus() != null ? request.getStatus() : TenantStatus.ACTIVE)
                .enabledModules(request.getEnabledModules())
                .build();

        return TenantResponse.from(tenantRepository.save(tenant));
    }

    // ── Update ────────────────────────────────────────────────────────────────

    /**
     * Updates an existing Tenant by ID.
     * Uniqueness checks exclude the current tenant's own record (IdNot variants).
     */
    public TenantResponse updateTenant(String id, TenantRequest request) {

        // Throws 404 if tenant doesn't exist — no silent no-ops
        Tenant tenant = tenantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Tenant not found with id: " + id));

        // Check NIP uniqueness, ignoring the current tenant's own NIP
        if (tenantRepository.existsByNipAndIdNot(request.getNip(), id)) {
            throw new IllegalArgumentException(
                    "Another tenant with NIP " + request.getNip() + " already exists");
        }

        // Check email uniqueness, ignoring the current tenant's own email
        if (tenantRepository.existsByEmailAndIdNot(request.getEmail(), id)) {
            throw new IllegalArgumentException(
                    "Another tenant with email " + request.getEmail() + " already exists");
        }

        // Apply all fields from the request — this is a full replacement (PUT semantics)
        tenant.setName(request.getName());
        tenant.setNip(request.getNip());
        tenant.setRegon(request.getRegon());
        tenant.setEmail(request.getEmail());
        tenant.setPhone(request.getPhone());
        tenant.setAddress(request.getAddress());
        tenant.setCity(request.getCity());
        tenant.setPostalCode(request.getPostalCode());
        tenant.setStatus(request.getStatus() != null ? request.getStatus() : tenant.getStatus());
        tenant.setEnabledModules(request.getEnabledModules());
        tenant.setUpdatedAt(LocalDateTime.now());

        return TenantResponse.from(tenantRepository.save(tenant));
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    /**
     * Permanently deletes a Tenant by ID.
     * Throws 404 if the tenant does not exist.
     */
    public void deleteTenant(String id) {
        Tenant tenant = tenantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Tenant not found with id: " + id));

        tenantRepository.delete(tenant);
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    /**
     * Returns a single Tenant by ID.
     * Throws 404 if not found.
     */
    public TenantResponse getTenantById(String id) {
        Tenant tenant = tenantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Tenant not found with id: " + id));

        return TenantResponse.from(tenant);
    }

    /**
     * Returns a paginated, optionally filtered list of tenants.
     *
     * Filtering logic:
     *   - Both search + status → findByNameContainingIgnoreCaseAndStatus
     *   - search only          → findByNameContainingIgnoreCase
     *   - status only          → findByStatus
     *   - neither              → findAll (with pagination)
     *
     * @param search   partial company name to search for (case-insensitive), may be null/blank
     * @param status   filter by TenantStatus, may be null to return all statuses
     * @param pageable Spring Pageable (page index, size, sort) from request query params
     */
    public TenantPageResponse getAllTenants(String search, TenantStatus status, Pageable pageable) {

        boolean hasSearch = search != null && !search.isBlank();
        boolean hasStatus = status != null;

        Page<TenantResponse> page;

        if (hasSearch && hasStatus) {
            page = tenantRepository
                    .findByNameContainingIgnoreCaseAndStatus(search, status, pageable)
                    .map(TenantResponse::from);
        } else if (hasSearch) {
            page = tenantRepository
                    .findByNameContainingIgnoreCase(search, pageable)
                    .map(TenantResponse::from);
        } else if (hasStatus) {
            page = tenantRepository
                    .findByStatus(status, pageable)
                    .map(TenantResponse::from);
        } else {
            page = tenantRepository
                    .findAll(pageable)
                    .map(TenantResponse::from);
        }

        return TenantPageResponse.from(page);
    }
}
