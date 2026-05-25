package com.ksefflow.backend.models;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import com.ksefflow.backend.models.utils.KsefEnvironment;
import com.ksefflow.backend.models.utils.KsefGovernmentStatus;


import java.time.LocalDateTime;

// Represents the active authenticated session between KSeFFlow and the Polish KSeF API.
//
// KSeF uses a challenge-response authentication flow:
//   1. POST /api/online/Session/AuthorisationChallenge → returns an encrypted challenge
//   2. The challenge is decrypted using the tenant's private key (from the HSM vault)
//   3. POST /api/online/Session/Authorisation → returns a session token (valid 24 hours)
//   4. All subsequent API calls include the session token in the Authorization header
//
// One active session per tenant at any time (unique index on tenantId).
// Session records are updated in place (not appended) — only one row per tenant.
// Historical session events are captured in KsefAuditLog.
//
// Session expiry logic:
//   - Sessions expire after 24 hours (KSeF enforced)
//   - Background job checks sessionExpiresAt and re-authenticates automatically
//   - If the certificate used for auth has been revoked, the session is invalidated
@Document(collection = "ksef_government_sessions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KsefGovernmentSession {

    @Id
    private String id;

    // ── Multi-tenancy — unique: one session record per tenant ──────────────────

    @Indexed(unique = true)
    private String tenantId;

    // ── Session state ──────────────────────────────────────────────────────────

    @Builder.Default
    private boolean active = false;

    // SANDBOX or PRODUCTION — determines which KSeF API base URL is used
    @Builder.Default
    private KsefEnvironment environment = KsefEnvironment.SANDBOX;

    // Opaque session token returned by KSeF after successful authentication.
    // Included as bearer token in subsequent API requests.
    // Encrypted at rest using the tenant's KMS key before storing.
    private String sessionToken;

    // Current operational status of the government API connection
    @Builder.Default
    private KsefGovernmentStatus status = KsefGovernmentStatus.DISCONNECTED;

    // KsefCertificate._id that was used to open this session
    private String activeCertificateId;

    // Most recent ping latency in milliseconds — updated by health-check cron job
    private Long lastPingMs;

    // ── Session lifecycle timestamps ───────────────────────────────────────────

    private LocalDateTime sessionStartedAt;

    // When the session token expires (KSeF enforces 24-hour max session lifetime)
    private LocalDateTime sessionExpiresAt;

    // When the last successful API call or health-check ping occurred
    private LocalDateTime lastSyncTime;

    // ── Audit timestamps ───────────────────────────────────────────────────────

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime updatedAt;
}
