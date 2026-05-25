package com.ksefflow.backend.models;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

// Immutable audit log for every security-relevant action in KSeFFlow.
//
// Compliance requirements (CLAUDE.md / Polish e-invoicing law):
//   - Audit logs MUST be tamper-resistant — never update or delete entries.
//   - Minimum retention: 10 years alongside the invoices they describe.
//   - Must record: user, tenant, IP, timestamp, old value, new value, action.
//   - Exportable to CSV for forensic investigation or government audit requests.
//
// This is KSeFFlow-specific. The RegulaOne platform has its own general audit log
// for platform-wide events (login, user management, billing) — this one covers
// only KSeF e-invoicing operations.
//
// Key action codes (non-exhaustive):
//   INVOICE_DRAFT_CREATED, INVOICE_SUBMITTED, INVOICE_SENT, INVOICE_FAILED,
//   INVOICE_RETRIED, INVOICE_OFFLINE_QUEUED, OFFLINE_QUEUE_FLUSHED,
//   CERTIFICATE_UPLOADED, CERTIFICATE_REVOKED, CERTIFICATE_VERIFIED,
//   KSEF_SESSION_OPENED, KSEF_SESSION_CLOSED, UPO_RECEIVED, UPO_VERIFIED,
//   USER_JWT_AUTH_SUCCESS, USER_SESSION_TERMINATED, RBAC_ROLE_TRANSITION,
//   TENANT_SWITCHED, ENV_TOGGLED_SANDBOX, ENV_TOGGLED_PRODUCTION
@Document(collection = "ksef_audit_logs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndex(def = "{'tenantId': 1, 'timestamp': -1}")
public class KsefAuditLog {

    @Id
    private String id;

    // ── Multi-tenancy ──────────────────────────────────────────────────────────

    @Indexed
    private String tenantId;

    // ── Actor ──────────────────────────────────────────────────────────────────

    // User._id from the RegulaOne auth service
    private String userId;

    // Email snapshot — stored even if the user is later deleted or renamed
    private String userEmail;

    // Role at the time of the action — may differ from the user's current role
    private String userRole;

    // ── Action ─────────────────────────────────────────────────────────────────

    // Enumeration-style action code — uppercase underscore e.g. INVOICE_SUBMITTED
    private String action;

    // MongoDB document ID of the entity affected by this action
    private String targetEntityId;

    // Human-readable entity type: "INVOICE", "CERTIFICATE", "SESSION", etc.
    private String targetEntityType;

    // ── Change tracking ────────────────────────────────────────────────────────

    // Previous state or value — null for CREATE operations
    private String oldValue;

    // New state or descriptive detail about what changed
    private String newValue;

    // ── Security context ───────────────────────────────────────────────────────

    private String ipAddress;
    private String userAgent;

    // ── Compliance ─────────────────────────────────────────────────────────────

    // True when the action was validated against the compliance ruleset at runtime
    @Builder.Default
    private boolean complianceChecked = true;

    // KSeF API correlation ID from the response headers — links this log entry
    // to a specific government API call for cross-system traceability
    private String ksefCorrelationId;

    // ── Immutable timestamp ────────────────────────────────────────────────────
    // No updatedAt field — audit logs must never be modified after creation.

    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();
}
