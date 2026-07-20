package com.privacypilot.backend.repository;

import com.privacypilot.backend.model.document.AuditEntry;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

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

    // The newest entry for a company. Kept for a future tamper-evidence hash chain
    // (each new entry can link back to this one).
    AuditEntry findFirstByTenantIdOrderByCreatedAtDesc(String tenantId);

    // How many audit entries a company has — handy for dashboards.
    long countByTenantId(String tenantId);
}
