package com.safevoice.backend.repository;

import com.safevoice.backend.model.document.AuditLog;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * MongoDB repository for managing immutable AuditLog documents.
 */
@Repository
public interface AuditLogRepository extends MongoRepository<AuditLog, String> {

    /**
     * Retrieves all audit logs for a tenant.
     */
    List<AuditLog> findAllByTenantId(String tenantId);

    /**
     * Finds the latest audit log entry for a tenant ordered by timestamp descending.
     * Used for calculating SHA-256 tamper-evident hash links.
     */
    AuditLog findFirstByTenantIdOrderByTimestampDesc(String tenantId);

    /**
     * Counts all sealed audit entries for a tenant — shown on the dashboard as
     * "audit entries sealed".
     */
    long countByTenantId(String tenantId);
}
