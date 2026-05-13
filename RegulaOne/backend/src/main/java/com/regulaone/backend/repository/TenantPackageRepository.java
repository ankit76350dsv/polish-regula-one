package com.regulaone.backend.repository;

import com.regulaone.backend.models.TenantPackage;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

/**
 * MongoDB repository for TenantPackage junction documents.
 *
 * The compound unique index (tenantId + packageId) is defined on the entity class itself
 * via @CompoundIndex — no additional index configuration needed here.
 */
public interface TenantPackageRepository extends MongoRepository<TenantPackage, String> {

    // Returns all package assignments for a given tenant — used to list tenant's packages
    List<TenantPackage> findByTenantId(String tenantId);

    // Returns all tenant assignments for a given package — useful for impact analysis before deletion
    List<TenantPackage> findByPackageId(String packageId);

    // Used to look up a specific assignment before updating or deleting it
    Optional<TenantPackage> findByTenantIdAndPackageId(String tenantId, String packageId);

    // Used to prevent duplicate assignments before saving
    boolean existsByTenantIdAndPackageId(String tenantId, String packageId);

    // Removes a specific assignment when a package is removed from a tenant
    void deleteByTenantIdAndPackageId(String tenantId, String packageId);
}
