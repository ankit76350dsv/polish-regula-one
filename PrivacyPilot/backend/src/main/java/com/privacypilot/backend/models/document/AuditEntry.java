package com.privacypilot.backend.model.document;

import com.privacypilot.backend.model.base.BaseDocument;
import com.privacypilot.backend.model.enums.audit.AuditAction;
import com.privacypilot.backend.model.enums.audit.AuditEntityType;
import com.privacypilot.backend.security.PrivacyPilotPermission;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

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
 *
 * WHO and WHEN are NOT stored twice: because an audit row is written once and
 * never changed, the "who" and "when" of the action are exactly the record's
 * own creation stamps, which {@link BaseDocument} already fills automatically:
 *  - WHEN the action happened   → inherited {@code createdAt} (@CreatedDate)
 *  - the id of WHO did it        → inherited {@code createdBy} (@CreatedBy)
 * Spring Data auditing (@EnableMongoAuditing + an AuditorAware returning the
 * current user id) MUST be switched on so these are always populated — they are
 * the legal backbone of the trail, so they must never be left null.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "privacypilot_audit_log")
// Lets us quickly pull "every action a given user took, newest first" — the
// query the old standalone actorId index used to serve.
@CompoundIndexes({
    @CompoundIndex(name = "audit_actor_time_idx", def = "{'createdBy': 1, 'createdAt': -1}")
})
public class AuditEntry extends BaseDocument {

    // The name the user had at the time of the action. This is a deliberate
    // snapshot, NOT a duplicate of the user record: the log must still read
    // correctly years later even if that user is renamed or erased.
    private String actorName;

    // The permission code the user held at the time of the action. Also a
    // point-in-time snapshot — a person's permissions can change, but the log
    // must show the capacity they actually acted under.
    private PrivacyPilotPermission actorRole;

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
