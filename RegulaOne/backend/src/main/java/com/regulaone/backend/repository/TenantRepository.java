package com.regulaone.backend.repository;

import com.regulaone.backend.models.Tenant;
import com.regulaone.backend.models.TenantStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

/**
 * MongoDB repository for Tenant documents.
 *
 * Spring Data derives the queries from method names automatically.
 * Pageable support is built-in — pass a PageRequest to get a Page<Tenant> back.
 */
public interface TenantRepository extends MongoRepository<Tenant, String> {

    // --- Search with pagination ---

    // Search by company name (case-insensitive substring match) — used in list API
    Page<Tenant> findByNameContainingIgnoreCase(String name, Pageable pageable);

    // Filter by status only — used when no search term is provided
    Page<Tenant> findByStatus(TenantStatus status, Pageable pageable);

    // Combined filter: name search + status — used when both query params are supplied
    Page<Tenant> findByNameContainingIgnoreCaseAndStatus(String name, TenantStatus status, Pageable pageable);

    // --- Uniqueness checks ---

    // Used on create to prevent duplicate NIP registrations
    boolean existsByNip(String nip);

    // Used on create to prevent duplicate email registrations
    boolean existsByEmail(String email);

    // Used on update — checks for NIP conflicts excluding the current tenant's own record
    boolean existsByNipAndIdNot(String nip, String id);

    // Used on update — checks for email conflicts excluding the current tenant's own record
    boolean existsByEmailAndIdNot(String email, String id);

    // Finds all tenants whose currentPackage @DBRef points to the given package ID.
    // Used by deletePackage() to nullify stale references before the package document is removed.
    java.util.List<Tenant> findByCurrentPackageId(String packageId);
}
