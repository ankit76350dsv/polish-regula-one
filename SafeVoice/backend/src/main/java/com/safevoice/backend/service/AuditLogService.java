package com.safevoice.backend.service;

import com.safevoice.backend.model.document.AuditLog;
import com.safevoice.backend.model.enums.audit.AuditActionType;
import com.safevoice.backend.model.enums.audit.AuditOutcome;
import com.safevoice.backend.repository.AuditLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;

/**
 * Service representing compliance-grade tamper-evident audit logging.
 * Calculates cryptographic SHA-256 hash chains connecting log events within a tenant.
 */
@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    @Autowired
    public AuditLogService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    /**
     * Records a compliance action, computing the SHA-256 hashchain link from the previous entry.
     */
    public synchronized AuditLog log(
            String tenantId,
            String actorRole,
            String actorRef,
            AuditActionType actionType,
            String subjectId,
            AuditOutcome outcome,
            String oldValue,
            String newValue,
            String metadataNotice) {

        Instant timestamp = Instant.now();
        
        // Find latest audit log for this tenant to retrieve the previous hash link
        AuditLog previousLog = auditLogRepository.findFirstByTenantIdOrderByTimestampDesc(tenantId);
        String previousHash = (previousLog != null) ? previousLog.getHashChain() : "0000000000000000000000000000000000000000000000000000000000000000";

        // Construct string to hash
        String dataToHash = String.format("%s|%s|%s|%s|%s|%s|%s|%s|%s|%s",
                tenantId,
                actorRole,
                actorRef,
                actionType.name(),
                subjectId != null ? subjectId : "null",
                outcome.name(),
                oldValue != null ? oldValue : "",
                newValue != null ? newValue : "",
                timestamp.toString(),
                previousHash
        );

        String hashChain = calculateSha256(dataToHash);

        AuditLog auditLog = AuditLog.builder()
                .tenantId(tenantId)
                .actorRole(actorRole)
                .actorRef(actorRef)
                .actionType(actionType)
                .subjectId(subjectId)
                .timestamp(timestamp)
                .outcome(outcome)
                .oldValue(oldValue)
                .newValue(newValue)
                .metadataNotice(metadataNotice)
                .hashChain(hashChain)
                .build();

        return auditLogRepository.save(auditLog);
    }

    // Largest number of audit rows one fetch may return, so the screen can never pull
    // years of history at once. Requests above this are clamped down to it.
    private static final int MAX_AUDIT_LIMIT = 500;
    private static final int DEFAULT_AUDIT_LIMIT = 200;

    /**
     * Read the most recent audit entries for a tenant, newest first.
     *
     * Read-only: this never alters the immutable log. The tenant is required (we never
     * read another organisation's trail), and the limit is clamped to a safe range so a
     * bad value can neither return nothing nor pull the entire history.
     *
     * @param tenantId the organisation whose trail to read (required)
     * @param limit    the most rows to return
     */
    public List<AuditLog> getRecent(String tenantId, int limit) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new IllegalArgumentException("Tenant info/context is required");
        }
        int safeLimit = limit < 1 ? DEFAULT_AUDIT_LIMIT : Math.min(limit, MAX_AUDIT_LIMIT);
        return auditLogRepository.findByTenantIdOrderByTimestampDesc(
                tenantId, PageRequest.of(0, safeLimit));
    }

    private String calculateSha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 hash calculation failed", e);
        }
    }
}
