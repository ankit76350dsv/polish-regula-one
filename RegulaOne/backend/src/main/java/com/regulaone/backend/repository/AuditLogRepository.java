package com.regulaone.backend.repository;

import com.regulaone.backend.models.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

/**
 * Storage for RegulaOne's own audit trail.
 *
 * APPEND AND READ ONLY. This interface deliberately declares no update or delete
 * helper: audit entries must stay exactly as they were written (see
 * {@link AuditLog}). {@code MongoRepository} does inherit generic save/delete
 * methods, so the rule is enforced by only ever calling insert through
 * {@code AuditLogService} — nothing else in the codebase touches this repository.
 */
public interface AuditLogRepository extends MongoRepository<AuditLog, String> {

    /** One company's trail, newest first — for the future audit screen and exports. */
    Page<AuditLog> findByTenantIdOrderByTimestampDesc(String tenantId, Pageable pageable);
}
