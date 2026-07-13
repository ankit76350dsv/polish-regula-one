package com.safevoice.backend.model.document;

import com.safevoice.backend.model.enums.audit.AuditActionType;
import com.safevoice.backend.model.enums.audit.AuditOutcome;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * MongoDB document representing immutable, compliance-grade audit logs.
 * Captures historical events, actor references, outcomes, and cryptographic hash chains.
 * Does not inherit from BaseDocument to ensure soft deletes or updates cannot be performed.
 */
@Getter
@Builder(toBuilder = true)
@ToString
@EqualsAndHashCode
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "safevoice_audit_logs")
public class AuditLog {

    @Id
    private String id;

    @Indexed
    private String tenantId;

    // WHO performed the action, as a single human-readable name: a staff member's name
    // (resolved from the RegulaOne users collection), "Anonymous Whistleblower" for the reporter,
    // or "System" for an automated job. Feeds the tamper-evident hashChain.
    private String actorName;

    private AuditActionType actionType;

    // The id of the entity the action was ABOUT — normally the case id. Records exactly WHAT was
    // acted on and powers the per-subject audit-trail filter (e.g. all events for one case).
    private String subjectId;

    @Builder.Default
    private Instant timestamp = Instant.now();

    private AuditOutcome outcome;

    private String oldValue;

    private String newValue;

    private String metadataNotice;

    private String hashChain; // Hash link to prevent tampering
}
