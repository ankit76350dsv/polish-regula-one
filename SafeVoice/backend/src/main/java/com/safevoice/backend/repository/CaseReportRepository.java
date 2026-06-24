package com.safevoice.backend.repository;

import com.safevoice.backend.model.document.CaseReport;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

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
     * Lists all non-soft-deleted case reports for a tenant.
     */
    List<CaseReport> findAllByTenantIdAndDeletedFalse(String tenantId);
}
