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
// KSeF 2.0 uses a token-based authentication flow (the legacy 1.0 challenge→session-token
// flow is removed):
//   1. POST /auth/challenge → { challenge, timestamp }
//   2. Build an AuthTokenRequest XML, sign it with XAdES using the tenant certificate
//   3. POST /auth/xades-signature → { referenceNumber, authenticationToken } (async)
//   4. GET  /auth/{referenceNumber} → poll until the operation succeeds
//   5. POST /auth/token/redeem → { accessToken (JWT, short-lived), refreshToken (up to 7 days) }
//   6. All subsequent API calls send "Authorization: Bearer {accessToken}"
//   7. POST /auth/token/refresh → a fresh accessToken without re-authenticating
//
// One active session per tenant at any time (unique index on tenantId).
// Session records are updated in place (not appended) — only one row per tenant.
// Historical session events are captured in KsefAuditLog.
//
// Both tokens are AES-256-GCM encrypted at rest before storage.
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

    // KSeF 2.0 accessToken (JWT) returned by POST /auth/token/redeem (or /refresh).
    // Sent as "Authorization: Bearer {accessToken}" on every protected API call.
    // Short-lived (minutes). AES-256-GCM encrypted at rest. (Field name kept as
    // sessionToken for backward compatibility with existing stored documents.)
    private String sessionToken;

    // KSeF 2.0 refreshToken (JWT) returned by POST /auth/token/redeem.
    // Used to mint a fresh accessToken via /auth/token/refresh without re-running the
    // full XAdES authentication. Long-lived (up to 7 days). AES-256-GCM encrypted at rest.
    private String refreshToken;

    // When the long-lived refreshToken stops being usable for refresh.
    private LocalDateTime refreshTokenExpiresAt;

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
