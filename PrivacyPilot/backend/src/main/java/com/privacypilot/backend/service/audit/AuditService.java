package com.privacypilot.backend.service;

import com.privacypilot.backend.model.document.AuditEntry;
import com.privacypilot.backend.model.enums.audit.AuditAction;
import com.privacypilot.backend.model.enums.audit.AuditEntityType;
import com.privacypilot.backend.repository.AuditEntryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * The ONE place the whole app writes audit entries.
 *
 * Every important change — create, update, delete, approve, export, ... — should
 * be recorded by calling a method here. Routing all writes through this single
 * service means:
 *   - every audit line is built the same way (no field is ever forgotten);
 *   - the trail stays write-once — this service only ever INSERTS, never edits or
 *     deletes an entry;
 *   - if we later add tamper-evidence (a SHA-256 hash chain, like SafeVoice), we
 *     add it HERE once and every caller gets it for free.
 *
 * WHO did it and WHEN are filled automatically: {@code createdBy} and
 * {@code createdAt} come from Spring Data auditing (see MongoAuditingConfig).
 * The human-readable actor name/role and the request IP/user-agent come from the
 * {@link AuditContext} the caller passes in.
 *
 * Typical use inside a controller/service, after a change succeeds:
 * <pre>
 *   auditService.record(ctx, AuditAction.UPDATE, AuditEntityType.DSAR, dsar.getId(),
 *           "Access — " + dsar.getRequesterName(), oldValues, newValues);
 * </pre>
 */
@Service
@RequiredArgsConstructor  // Lombok builds the constructor for the final field below,
                          // so Spring injects the repository automatically.
public class AuditService {

    private final AuditEntryRepository auditEntryRepository;

    /**
     * The core write. Records ONE action in the audit trail and returns the saved
     * entry. Use this directly for actions that do not fit create/update/delete
     * (for example EXPORT, GENERATE, APPROVE, LOGIN); pass null for values that do
     * not apply.
     *
     * @param context     who did it and from where (required; must carry a tenant id)
     * @param action      what kind of action it was (required)
     * @param entityType  which kind of record it was about (required)
     * @param entityId    the id of that record (may be null for app-wide actions)
     * @param entityLabel a readable label for that record, so the log reads well
     * @param oldValue    the values BEFORE the change (null for a create)
     * @param newValue    the values AFTER the change (null for a delete)
     */
    public AuditEntry record(AuditContext context, AuditAction action, AuditEntityType entityType,
                             String entityId, String entityLabel,
                             Map<String, Object> oldValue, Map<String, Object> newValue) {

        // Guard the things a legal audit line can never be missing. We fail loudly
        // rather than write a broken, un-attributable record.
        if (context == null) {
            throw new IllegalArgumentException("Audit context is required");
        }
        if (context.tenantId() == null || context.tenantId().isBlank()) {
            throw new IllegalArgumentException("Tenant id is required for every audit entry");
        }
        if (action == null) {
            throw new IllegalArgumentException("Audit action is required");
        }
        if (entityType == null) {
            throw new IllegalArgumentException("Audit entity type is required");
        }

        AuditEntry entry = new AuditEntry();
        entry.setTenantId(context.tenantId());
        entry.setActorName(context.actorName());
        entry.setActorRole(context.actorRole());
        entry.setAction(action);
        entry.setEntityType(entityType);
        entry.setEntityId(entityId);
        entry.setEntityLabel(entityLabel);
        entry.setOldValue(oldValue);
        entry.setNewValue(newValue);
        entry.setIpAddress(context.ipAddress());
        entry.setUserAgent(context.userAgent());

        // insert() (not save()) makes the write-once intent explicit: we are always
        // adding a NEW entry, never updating an existing one.
        return auditEntryRepository.insert(entry);
    }

    /** Record a CREATE. There is no "before" state, so oldValue is null. */
    public AuditEntry recordCreate(AuditContext context, AuditEntityType entityType,
                                   String entityId, String entityLabel,
                                   Map<String, Object> newValue) {
        return record(context, AuditAction.CREATE, entityType, entityId, entityLabel, null, newValue);
    }

    /**
     * Record a simple action that has no before/after values — for example EXPORT,
     * GENERATE, APPROVE, SIGN or LOGIN.
     */
    public AuditEntry recordAction(AuditContext context, AuditAction action,
                                   AuditEntityType entityType, String entityId, String entityLabel) {
        return record(context, action, entityType, entityId, entityLabel, null, null);
    }
}
