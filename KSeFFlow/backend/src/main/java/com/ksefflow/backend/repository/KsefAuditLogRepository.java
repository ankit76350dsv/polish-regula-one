package com.ksefflow.backend.repository;

import com.ksefflow.backend.models.KsefAuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDateTime;
import java.util.List;

// Repository for the ksef_audit_logs collection.
// All methods are read-only by convention — audit logs are immutable.
// No delete methods are exposed; only save() is ever called (via MongoRepository.save).
public interface KsefAuditLogRepository extends MongoRepository<KsefAuditLog, String> {

    // Paginated list for the Compliance Audit Center — newest entries first
    Page<KsefAuditLog> findByTenantIdOrderByTimestampDesc(String tenantId, Pageable pageable);

    // Filter by user role — used by the role-filter dropdown in the Audit Center
    Page<KsefAuditLog> findByTenantIdAndUserRoleOrderByTimestampDesc(String tenantId, String userRole, Pageable pageable);

    // Search across email, action, and details — used by the search bar
    Page<KsefAuditLog> findByTenantIdAndUserEmailContainingIgnoreCaseOrderByTimestampDesc(String tenantId, String userEmail, Pageable pageable);

    // All logs for a specific entity — used in the invoice detail panel to show its history
    List<KsefAuditLog> findByTenantIdAndTargetEntityIdOrderByTimestampDesc(String tenantId, String targetEntityId);

    // Date-range query for CSV export (Download All button in the Audit Center)
    List<KsefAuditLog> findByTenantIdAndTimestampBetweenOrderByTimestampDesc(
            String tenantId, LocalDateTime from, LocalDateTime to);

    // Platform-wide SuperAdmin query — all logs across all tenants
    Page<KsefAuditLog> findAllByOrderByTimestampDesc(Pageable pageable);
}
