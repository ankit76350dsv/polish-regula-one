package com.privacypilot.backend.model.document;

import com.privacypilot.backend.model.base.BaseDocument;
import com.privacypilot.backend.model.enums.audit.AuditAction;
import com.privacypilot.backend.model.enums.audit.AuditEntityType;
import com.privacypilot.backend.model.enums.user.PrivacyRole;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;

/**
 * One line in the immutable audit trail. Every important change writes one of
 * these so the company can always answer: WHO did WHAT, to WHICH record, WHEN,
 * from WHERE, and what the values were BEFORE and AFTER.
 *
 * These records are write-once evidence. They are never edited or deleted and
 * are kept for 10 years to support audits and investigations. To keep them
 * tamper-resistant, the app should only ever INSERT audit entries — never update
 * them.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "privacypilot_audit_log")
public class AuditEntry extends BaseDocument {

    // When the action happened.
    private Instant at;

    // The id of the user who did it.
    @Indexed
    private String actorId;

    // The name of the user who did it (kept for readable logs).
    private String actorName;

    // The role the user had at the time.
    private PrivacyRole actorRole;

    // What was done (create, update, approve, ...).
    private AuditAction action;

    // Which kind of record it was done to (activity, breach, ...).
    private AuditEntityType entityType;

    // The id of the specific record that changed.
    @Indexed
    private String entityId;

    // A readable label for that record (so the log reads well without a lookup).
    private String entityLabel;

    // The values BEFORE the change. Free-form so it fits any record type.
    // Null for a "create" action (there was nothing before).
    private Map<String, Object> oldValue;

    // The values AFTER the change. Free-form so it fits any record type.
    // Null for a "delete" action (there is nothing after).
    private Map<String, Object> newValue;

    // The IP address the action came from.
    private String ipAddress;

    // The browser/user-agent string the action came from.
    private String userAgent;
}
