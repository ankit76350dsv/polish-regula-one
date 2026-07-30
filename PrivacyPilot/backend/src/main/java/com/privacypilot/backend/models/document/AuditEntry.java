package com.privacypilot.backend.model.document;

import com.privacypilot.backend.model.base.BaseDocument;
import com.privacypilot.backend.model.enums.audit.AuditAction;
import com.privacypilot.backend.model.enums.audit.AuditEntityType;
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
// ── Indexes ──────────────────────────────────────────────────────────────────
// WHY THESE EXACT SHAPES: the audit screen always wants entries NEWEST FIRST, and it
// always narrows by company first. Each index below therefore lists the fields it matches
// exactly (tenantId, deleted, and optionally the record type or record id) and finishes
// with createdAt descending — the order the screen asks for. That lets MongoDB read the
// rows straight out of the index in the right order and stop at the row limit, instead of
// gathering everything and sorting it in memory (which it refuses to do past 32 MB — and
// this collection is kept for ten years).
//
// IMPORTANT: annotations alone do NOT create indexes — Spring Data's automatic index
// creation is OFF by default in this version. MongoIndexConfig creates them at start-up.
@CompoundIndexes({
    // The default screen: one company's trail, newest first. Also serves the "action"
    // filter and any date range, which narrow the same index walk.
    @CompoundIndex(name = "audit_tenant_time_idx",
            def = "{'tenantId': 1, 'deleted': 1, 'createdAt': -1}"),
    // Filtered to one kind of record, e.g. only DSAR lines.
    @CompoundIndex(name = "audit_tenant_type_time_idx",
            def = "{'tenantId': 1, 'deleted': 1, 'entityType': 1, 'createdAt': -1}"),
    // The full history of ONE record — what "show me everything that happened to this
    // activity" needs.
    @CompoundIndex(name = "audit_tenant_entity_time_idx",
            def = "{'tenantId': 1, 'deleted': 1, 'entityId': 1, 'createdAt': -1}"),
    // "Every action a given user took, newest first" — for investigating one person.
    @CompoundIndex(name = "audit_actor_time_idx", def = "{'createdBy': 1, 'createdAt': -1}")
})
public class AuditEntry extends BaseDocument {

    // The name the user had at the time of the action. This is a deliberate
    // snapshot, NOT a duplicate of the user record: the log must still read
    // correctly years later even if that user is renamed or erased.
    private String actorName;

    // The single capacity the user acted under, stored as a code snapshot.
    // A user can hold MANY permissions, so this keeps just the most privileged
    // PrivacyPilot code they had at the time (e.g. "PRIVACYPILOT_ADMIN", from
    // RegulaOneUser.primaryPrivacyPilotRole()). If they held no PrivacyPilot code
    // at all (e.g. a platform super-admin acting across tenants), it falls back
    // to their platform role so this is NEVER empty. Kept as text, not the enum,
    // so that fallback value fits too.
    private String actorRole;

    // What was done (create, update, approve, ...).
    private AuditAction action;

    // Which kind of record it was done to (activity, breach, ...).
    private AuditEntityType entityType;

    // The id of the specific record that changed.
    // NOTE on the index: every read of this collection is scoped to one company first, so
    // "the history of record X" is served by the audit_tenant_entity_time_idx compound index
    // above, not by this single-field one. It is kept because it is harmless and pre-dates
    // the compound indexes, but if insert throughput on this collection ever needs tuning,
    // this is the one index that can be dropped without slowing any current query down.
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
