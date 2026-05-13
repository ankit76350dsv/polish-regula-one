package com.regulaone.backend.repository;

import com.regulaone.backend.models.AppPackage;
import com.regulaone.backend.models.PackageStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

/**
 * MongoDB repository for AppPackage documents.
 * Spring Data derives all queries from method names — no manual query writing needed.
 */
public interface PackageRepository extends MongoRepository<AppPackage, String> {

    // --- Paginated search and filter ---

    // Search by package name (case-insensitive substring) — used in list API
    Page<AppPackage> findByNameContainingIgnoreCase(String name, Pageable pageable);

    // Filter by status only
    Page<AppPackage> findByStatus(PackageStatus status, Pageable pageable);

    // Combined: name search + status filter
    Page<AppPackage> findByNameContainingIgnoreCaseAndStatus(String name, PackageStatus status, Pageable pageable);

    // --- Uniqueness checks ---

    // Used on create to prevent duplicate package names
    boolean existsByName(String name);

    // Used on update — excludes current package's own name from the uniqueness check
    boolean existsByNameAndIdNot(String name, String id);
}
