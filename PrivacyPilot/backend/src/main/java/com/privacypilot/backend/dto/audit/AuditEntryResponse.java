package com.privacypilot.backend.dto.audit;

import com.privacypilot.backend.model.document.AuditEntry;
import com.privacypilot.backend.model.enums.audit.AuditAction;
import com.privacypilot.backend.model.enums.audit.AuditEntityType;

import java.time.Instant;
import java.util.Map;

/**
 * What ONE audit line looks like when the API hands it to the frontend.
 *
 * WHY a separate shape (not the raw {@link AuditEntry} document):
 *  - it exposes ONLY the fields the audit-trail screen needs, and hides internal
 *    database columns (tenantId, createdBy/updatedBy ids, soft-delete flags) that
 *    a client has no business seeing;
 *  - it renames the record's own creation stamp to {@code at}, which is exactly the
 *    field name the frontend audit trail already reads (so no UI change is needed);
 *  - the enums serialise to their string codes ("CREATE", "activity") via their
 *    {@code @JsonValue}, matching what the UI filters and displays.
 *
 * The trail is write-once evidence, so this is a read-only view — there is no
 * request DTO for creating an audit line from the outside; entries are written only
 * by the server through AuditService when a real change happens.
 */
public record AuditEntryResponse(
        String id,
        // WHEN the action happened — the entry's own creation time (write-once), sent
        // as "at" to match the frontend's existing field name.
        Instant at,
        // WHO did it — a name/role snapshot taken at the time, so the line still reads
        // correctly years later even if that user is renamed or removed.
        String actorName,
        String actorRole,
        // WHAT was done and to WHICH kind of record.
        AuditAction action,
        AuditEntityType entityType,
        String entityId,
        String entityLabel,
        // The BEFORE / AFTER values (either may be null: null "old" on a create,
        // null "new" on a delete).
        Map<String, Object> oldValue,
        Map<String, Object> newValue,
        // WHERE the action came from.
        String ipAddress,
        String userAgent) {

    /** Map one stored audit document to the read-only API shape. */
    public static AuditEntryResponse from(AuditEntry e) {
        return new AuditEntryResponse(
                e.getId(),
                e.getCreatedAt(),
                e.getActorName(),
                e.getActorRole(),
                e.getAction(),
                e.getEntityType(),
                e.getEntityId(),
                e.getEntityLabel(),
                e.getOldValue(),
                e.getNewValue(),
                e.getIpAddress(),
                e.getUserAgent());
    }
}
