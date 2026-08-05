package com.regulaone.backend.models;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

/**
 * RegulaOne's own immutable audit record.
 *
 * WHY THIS EXISTS: every compliance module (KSeFFlow, WorkPulse, SafeWork,
 * SafeVoice, WasteSync, PrivacyPilot) already keeps its own tamper-evident audit
 * trail, but the RegulaOne shell itself had none. That was a gap: RegulaOne is
 * where accounts, roles and cross-module oversight live, so actions taken here
 * need the same traceability the modules have.
 *
 * The first thing recorded through it is the cross-module compliance dashboard
 * read. That read touches figures derived from health-adjacent records (SafeWork
 * medical/BHP validity), working-time records and whistleblower deadlines, so who
 * looked at the company's compliance position — and when — is itself information
 * an auditor may legitimately ask for (GDPR Art. 5(2) accountability; Art. 32
 * security of processing).
 *
 * IMMUTABILITY: entries are only ever INSERTED. Nothing in this codebase updates
 * or deletes them — see AuditLogService, which exposes an append operation and
 * nothing else. Enforcing this at the database level (a MongoDB view or a
 * write-restricted role) is an infrastructure task and is noted in the docs.
 *
 * RETENTION: kept for at least 10 years, in line with the platform's legal
 * retention policy for audit data.
 *
 * WHAT MUST NEVER GO IN HERE: passwords, tokens, certificate contents, report
 * bodies, whistleblower case content, or any special-category personal data. The
 * record answers "who did what, where, when, and did it work" — nothing more.
 */
@Document(collection = "regulaone_audit_logs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
// The list query the audit screen will run: one company, newest first.
@CompoundIndex(name = "regulaone_audit_tenant_time_idx", def = "{'tenantId': 1, 'timestamp': -1}")
@CompoundIndex(name = "regulaone_audit_actor_time_idx", def = "{'userId': 1, 'timestamp': -1}")
public class AuditLog {

    @Id
    private String id;

    // The company the action concerned. Null only for platform-wide actions taken
    // by a super admin before any company context exists.
    @Indexed
    private String tenantId;

    // Who acted: the RegulaOne user id, their e-mail, and the role they held at the
    // time. The role is stored as text because a user's role can change later, and
    // the audit line must keep the role that actually applied.
    private String userId;
    private String userEmail;
    private String userRole;

    // What happened, as a stable machine code, e.g. "COMPANY_OVERVIEW_VIEWED".
    @Indexed
    private String action;

    // Which kind of thing it happened to, and its id when there is a single one.
    private String resource;
    private String resourceId;

    // Extra non-sensitive context. For the dashboard read this is the list of
    // module codes whose figures were actually returned, which is what makes the
    // entry useful: it shows the SCOPE of what the person saw.
    private List<String> details;

    // Where the request came from. Needed for security investigations (Art. 32)
    // and expected in the platform's audit-log field list.
    private String ipAddress;
    private String userAgent;

    // Did the action succeed? A denied attempt is worth recording too.
    @Builder.Default
    private boolean success = true;

    // Short reason when success is false. Never a stack trace.
    private String errorMessage;

    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();
}
