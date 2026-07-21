package com.privacypilot.backend.repository;

import com.privacypilot.backend.model.document.ProcessingActivity;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Database access for ROPA entries ({@link ProcessingActivity}).
 *
 * EVERY finder is scoped by tenantId and excludes soft-deleted rows, so one company
 * can never read another's register and "archived" (soft-deleted) entries stay out
 * of the live views while remaining on disk for the 10-year retention rule.
 */
@Repository
public interface ProcessingActivityRepository extends MongoRepository<ProcessingActivity, String> {

    // All live entries for one company, newest change first.
    List<ProcessingActivity> findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc(String tenantId);

    // One live entry, but only if it belongs to this company (else empty → 404).
    Optional<ProcessingActivity> findByIdAndTenantIdAndDeletedFalse(String id, String tenantId);
}
