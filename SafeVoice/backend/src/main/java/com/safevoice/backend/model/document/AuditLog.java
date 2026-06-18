package com.safevoice.backend.model.document;

import com.safevoice.backend.model.base.BaseDocument;
import com.safevoice.backend.model.enums.audit.AuditActionType;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.UUID;

/**
 * MongoDB document representing immutable, compliance-grade audit logs.
 * Captures historical events, actor references, outcomes, and cryptographic hash chains.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "audit_logs")
public class AuditLog extends BaseDocument {

    private String actorRole; // AppRole | "System" | "Public Portal"

    private String actorRef;

    private AuditActionType actionType;

    private UUID subjectId;

    private Instant timestamp;

    private String outcome; // Allowed | Denied | Recorded

    private String oldValue;

    private String newValue;

    private String metadataNotice;

    private String hashChain; // Hash link to prevent tampering
}
