package com.privacypilot.backend.repository;

import com.privacypilot.backend.model.document.AuditEntry;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Database access for the immutable audit trail ({@link AuditEntry}).
 *
 * The audit trail is write-once evidence, so in practice the app only ever
 * INSERTS through here (see AuditService). The read methods are for the audit-trail
 * screen and for future tamper-evidence checks — they never change a record.
 *
 * Multi-row reads are declared in {@link AuditEntryRepositoryCustom} and always carry a
 * row limit, because this collection grows for ten years and never shrinks.
 */
@Repository
public interface AuditEntryRepository extends MongoRepository<AuditEntry, String>,
        AuditEntryRepositoryCustom {

    // READS OF MANY ENTRIES LIVE IN AuditEntryRepositoryCustom (search / findRecent).
    //
    // WHY: the trail is append-only and kept for ten years, so any method that returns
    // "all entries for a company" is a time bomb — it gets bigger every day until the
    // request runs out of memory or MongoDB refuses to sort it. The three unlimited
    // finders that used to be here (all entries; all entries of one type; all entries for
    // one record) have been REPLACED by the single search() above, which always applies
    // the filters, the order and a row limit inside the database. Nothing was lost: every
    // question those finders answered, search() answers with a cap.

    // One audit entry, but ONLY if it belongs to the caller's company (else empty → 404).
    Optional<AuditEntry> findByIdAndTenantIdAndDeletedFalse(String id, String tenantId);

    // The newest entry for a company. Kept for a future tamper-evidence hash chain
    // (each new entry can link back to this one).
    AuditEntry findFirstByTenantIdOrderByCreatedAtDesc(String tenantId);

    // How many audit entries a company has — handy for dashboards.
    long countByTenantId(String tenantId);
}
