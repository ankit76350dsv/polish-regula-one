package com.safevoice.backend.repository;

import com.safevoice.backend.model.document.CaseReport;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * MongoDB repository for managing CaseReport documents.
 */
@Repository
public interface CaseReportRepository extends MongoRepository<CaseReport, String> {

    /**
     * Finds a case report within a specific tenant context by its tracking code.
     * Enforces tenant isolation.
     */
    Optional<CaseReport> findByTenantIdAndTrackingCode(String tenantId, String trackingCode);

    /**
     * Finds a case report by the SHA-256 fingerprint of its access key.
     * This is how the anonymous reporter flow looks a case up: we hash the key the
     * reporter types and match it against this stored fingerprint. The key fingerprint
     * is globally unique, so no tenant context is needed (and the reporter has none).
     */
    Optional<CaseReport> findByKeyHash(String keyHash);

    /**
     * Lists all non-soft-deleted case reports for a tenant.
     */
    List<CaseReport> findAllByTenantIdAndDeletedFalse(String tenantId);

    /**
     * Tells us whether a tenant already has a case with this readable reference.
     * The reference is built from the submission minute (e.g. "SV/2026/0629/1408"), so
     * two reports filed in the same minute would clash; we use this to detect that and
     * ask the second reporter to try again a minute later. Scoped to the tenant, because
     * each organisation has its own independent set of references.
     */
    boolean existsByTenantIdAndCaseReference(String tenantId, String caseReference);
}
