package com.ksefflow.backend.services.ksefauth;

import com.ksefflow.backend.config.KsefApiProperties;
import com.ksefflow.backend.dto.ksefapi.AuthChallengeResponse;
import com.ksefflow.backend.dto.ksefapi.AuthInitResponse;
import com.ksefflow.backend.dto.ksefapi.AuthStatusResponse;
import com.ksefflow.backend.dto.ksefapi.AuthTokenRefreshResponse;
import com.ksefflow.backend.dto.ksefapi.AuthTokensResponse;
import com.ksefflow.backend.exceptions.KsefAuthException;
import com.ksefflow.backend.models.KsefAuditLog;
import com.ksefflow.backend.repository.KsefAuditLogRepository;
import com.ksefflow.backend.services.certificate.CertificateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.time.LocalDateTime;
import java.util.Optional;

/**
 * KSeF 2.0 — token-based authentication.
 *
 * <p>{@link #openSession(String, String)} returns a usable {@code accessToken}, acquiring it
 * by the cheapest available path:
 * <ol>
 *   <li>reuse a still-valid stored accessToken;</li>
 *   <li>otherwise refresh it with a still-valid refreshToken (POST /auth/token/refresh);</li>
 *   <li>otherwise run the full XAdES authentication:
 *       challenge → build + XAdES-sign AuthTokenRequest → submit → poll status → redeem tokens.</li>
 * </ol>
 *
 * The legacy KSeF 1.0 challenge-signing + 24h "SessionToken" flow has been removed.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KSeFAuthService {

    // KSeF auth-operation status codes (GET /auth/{referenceNumber}).
    private static final int AUTH_STATUS_SUCCESS = 200;
    private static final int AUTH_POLL_MAX_ATTEMPTS = 10;
    private static final long AUTH_POLL_INTERVAL_MS = 1500;

    private final CertificateService certificateService;
    private final KsefApiClient ksefApiClient;
    private final KsefSessionStore sessionStore;
    private final XAdESSigner xadesSigner;
    private final KsefAuditLogRepository auditLogRepository;
    private final KsefApiProperties apiProperties;

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Returns a valid KSeF 2.0 accessToken for the tenant, authenticating if necessary.
     *
     * @param tenantId the tenant/company
     * @param nip      the 10-digit NIP that forms the authentication context
     */
    public String openSession(String tenantId, String nip) {
        log.info("[KSeF2 Auth] Acquiring accessToken for tenant [{}]", tenantId);

        // 1) Reuse a still-valid accessToken.
        Optional<String> active = sessionStore.getActiveAccessToken(tenantId);
        if (active.isPresent()) {
            log.info("[KSeF2 Auth] Reusing valid accessToken for tenant [{}]", tenantId);
            return active.get();
        }

        // 2) Refresh using a still-valid refreshToken — avoids a full re-auth.
        Optional<String> refresh = sessionStore.getValidRefreshToken(tenantId);
        if (refresh.isPresent()) {
            try {
                log.info("[KSeF2 Auth] Refreshing accessToken for tenant [{}]", tenantId);
                AuthTokenRefreshResponse refreshed = ksefApiClient.refreshAccessToken(refresh.get());
                sessionStore.updateAccessToken(tenantId, refreshed.accessToken());
                return refreshed.accessToken().token();
            } catch (KsefAuthException e) {
                log.warn("[KSeF2 Auth] Refresh failed for tenant [{}] — falling back to full auth: {}",
                        tenantId, e.getMessage());
            }
        }

        // 3) Full XAdES authentication.
        return authenticateWithCertificate(tenantId, nip);
    }

    public Optional<String> getActiveSessionToken(String tenantId) {
        return sessionStore.getActiveAccessToken(tenantId);
    }

    public boolean isSessionActive(String tenantId) {
        return sessionStore.getActiveAccessToken(tenantId).isPresent();
    }

    /** Deactivates the local token session for the tenant. */
    public void closeSession(String tenantId) {
        sessionStore.deactivateSession(tenantId);
        writeAuditLog(tenantId, "KSEF_SESSION_CLOSED", "local deactivation");
    }

    // ── Full certificate (XAdES) authentication ──────────────────────────────────

    private String authenticateWithCertificate(String tenantId, String nip) {
        // Guard: certificate must be active before any network calls.
        certificateService.validateCertificateActive(tenantId);

        try {
            // Step 1 — challenge
            AuthChallengeResponse challenge = ksefApiClient.getAuthChallenge();

            // Step 2 — build + XAdES-sign the AuthTokenRequest
            String unsignedXml = AuthTokenRequestBuilder.buildForNip(challenge.challenge(), nip);
            PrivateKey privateKey = certificateService.getPrivateKey(tenantId);
            X509Certificate cert = certificateService.getPublicCertificate(tenantId);
            String signedXml = xadesSigner.sign(unsignedXml, privateKey, cert);

            // Step 3 — submit signed XML, receive temporary auth operation token
            AuthInitResponse init = ksefApiClient.submitXadesSignature(signedXml);
            String authToken = init.authenticationToken().token();

            // Step 4 — poll until the async auth operation succeeds
            awaitAuthSuccess(init.referenceNumber(), authToken);

            // Step 5 — redeem the access + refresh tokens
            AuthTokensResponse tokens = ksefApiClient.redeemTokens(authToken);
            sessionStore.saveSession(tenantId, tokens.accessToken(), tokens.refreshToken());
            certificateService.recordAuthSuccess(tenantId);

            writeAuditLog(tenantId, "KSEF_SESSION_OPENED", "environment=" + apiProperties.getEnvironment());
            log.info("[KSeF2 Auth] Authentication complete for tenant [{}]", tenantId);
            return tokens.accessToken().token();

        } catch (KsefAuthException e) {
            log.error("[KSeF2 Auth] Authentication failed for tenant [{}]: {}", tenantId, e.getMessage(), e);
            certificateService.recordAuthFailure(tenantId);
            writeAuditLog(tenantId, "KSEF_SESSION_FAILED", e.getMessage());
            throw e;
        }
    }

    // Polls GET /auth/{referenceNumber} until the operation reports success or fails.
    private void awaitAuthSuccess(String referenceNumber, String authToken) {
        for (int attempt = 1; attempt <= AUTH_POLL_MAX_ATTEMPTS; attempt++) {
            AuthStatusResponse status = ksefApiClient.getAuthStatus(referenceNumber, authToken);
            Integer code = status.status() != null ? status.status().code() : null;

            if (code != null && code == AUTH_STATUS_SUCCESS) {
                log.info("[KSeF2 Auth] Auth operation [{}] succeeded", referenceNumber);
                return;
            }
            if (code != null && code >= 400) {
                throw new KsefAuthException("KSeF authentication rejected (code " + code + "): "
                        + (status.status().description() != null ? status.status().description() : ""));
            }
            // Still in progress (e.g. awaiting OCSP/CRL) — wait and retry.
            if (attempt < AUTH_POLL_MAX_ATTEMPTS) {
                sleepQuietly(AUTH_POLL_INTERVAL_MS);
            }
        }
        throw new KsefAuthException("KSeF authentication did not complete after "
                + AUTH_POLL_MAX_ATTEMPTS + " status checks for ref " + referenceNumber);
    }

    // ── Audit ────────────────────────────────────────────────────────────────────

    private void writeAuditLog(String tenantId, String action, String newValue) {
        try {
            auditLogRepository.save(KsefAuditLog.builder()
                    .tenantId(tenantId)
                    .action(action)
                    .targetEntityType("SESSION")
                    .newValue(newValue)
                    .complianceChecked(true)
                    .timestamp(LocalDateTime.now())
                    .build());
        } catch (Exception e) {
            log.error("Failed to write audit log [action={}] for tenant [{}]: {}", action, tenantId, e.getMessage());
        }
    }

    private static void sleepQuietly(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
