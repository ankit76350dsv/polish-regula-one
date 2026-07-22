package com.privacypilot.backend.repository;

import com.privacypilot.backend.model.document.AuditEntry;
import com.privacypilot.backend.model.enums.audit.AuditEntityType;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Database access for the immutable audit trail ({@link AuditEntry}).
 *
 * The audit trail is write-once evidence, so in practice the app only ever
 * INSERTS through here (see AuditService). The read methods below are for the
 * audit-trail screen and for future tamper-evidence checks — they never change
 * a record.
 */
@Repository
public interface AuditEntryRepository extends MongoRepository<AuditEntry, String> {

    // All audit entries for one company, so a tenant only ever sees its own trail.
    List<AuditEntry> findAllByTenantId(String tenantId);

    // The audit-trail screen: every entry for one company, NEWEST FIRST. The
    // `deletedFalse` guard is defensive — audit lines are never soft-deleted, but
    // filtering on it keeps the query consistent with every other read in the app.
    List<AuditEntry> findByTenantIdAndDeletedFalseOrderByCreatedAtDesc(String tenantId);

    // Same, narrowed to one kind of record (e.g. only "activity" changes), newest first.
    List<AuditEntry> findByTenantIdAndEntityTypeAndDeletedFalseOrderByCreatedAtDesc(
            String tenantId, AuditEntityType entityType);

    // The full history of ONE specific record (e.g. all changes to activity X), newest first.
    List<AuditEntry> findByTenantIdAndEntityIdAndDeletedFalseOrderByCreatedAtDesc(
            String tenantId, String entityId);

    // One audit entry, but ONLY if it belongs to the caller's company (else empty → 404).
    Optional<AuditEntry> findByIdAndTenantIdAndDeletedFalse(String id, String tenantId);

    // The newest entry for a company. Kept for a future tamper-evidence hash chain
    // (each new entry can link back to this one).
    AuditEntry findFirstByTenantIdOrderByCreatedAtDesc(String tenantId);

    // How many audit entries a company has — handy for dashboards.
    long countByTenantId(String tenantId);
}
