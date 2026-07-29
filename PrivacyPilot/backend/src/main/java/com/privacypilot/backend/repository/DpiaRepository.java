package com.privacypilot.backend.repository;

import com.privacypilot.backend.model.document.Dpia;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Database access for DPIA records ({@link Dpia}, Art. 35 GDPR).
 *
 * EVERY finder is scoped by tenantId and excludes soft-deleted rows, so one company
 * can never read another's assessments and "archived" (soft-deleted) DPIAs stay out
 * of the live views while remaining on disk for the 10-year retention rule.
 */
@Repository
public interface DpiaRepository extends MongoRepository<Dpia, String> {

    // All live DPIAs for one company, newest change first.
    List<Dpia> findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc(String tenantId);

    // One live DPIA, but only if it belongs to this company (else empty → 404).
    Optional<Dpia> findByIdAndTenantIdAndDeletedFalse(String id, String tenantId);

    // The live DPIA linked to a given activity (used to keep the activity↔DPIA link
    // consistent and to enforce "one DPIA per activity"). Empty if none yet.
    Optional<Dpia> findByActivityIdAndTenantIdAndDeletedFalse(String activityId, String tenantId);
}
