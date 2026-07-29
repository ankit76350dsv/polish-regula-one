package com.ksefflow.backend.services.ksefauth;

import com.ksefflow.backend.config.KsefApiProperties;
import com.ksefflow.backend.dto.ksefapi.AuthChallengeResponse;
import com.ksefflow.backend.dto.ksefapi.AuthInitResponse;
import com.ksefflow.backend.dto.ksefapi.AuthStatusResponse;
import com.ksefflow.backend.dto.ksefapi.AuthTokenRefreshResponse;
import com.ksefflow.backend.dto.ksefapi.AuthTokensResponse;
import com.ksefflow.backend.exceptions.KsefAuthException;
import com.ksefflow.backend.services.KSeFAuditLogService;
import com.ksefflow.backend.services.certificate.CertificateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.security.PrivateKey;
import java.security.cert.X509Certificate;
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
    private final KsefApiProperties apiProperties;

    //! ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Returns a valid KSeF 2.0 accessToken for the tenant, authenticating if necessary.
     *
     * @param tenantId the tenant/company
     * @param nip      the 10-digit NIP that forms the authentication context
     */
    public String openSession(String tenantId, String nip) {
        log.info("[OpenSession]:1 Acquiring accessToken for tenant [{}]", tenantId);

        // 1) Reuse a still-valid accessToken.
        Optional<String> active = sessionStore.getActiveAccessToken(tenantId);
        if (active.isPresent()) {
            log.info("[OpenSession]:2 Reusing valid accessToken for tenant [{}]", tenantId);
            return active.get();
        }

        // 2) Refresh using a still-valid refreshToken — avoids a full re-auth.
        Optional<String> refresh = sessionStore.getValidRefreshToken(tenantId);
        if (refresh.isPresent()) {
            try {
                log.info("[OpenSession]:3 Refreshing accessToken for tenant [{}]", tenantId);
                AuthTokenRefreshResponse refreshed = ksefApiClient.refreshAccessToken(refresh.get());
                sessionStore.updateAccessToken(tenantId, refreshed.accessToken());
                return refreshed.accessToken().token();
            } catch (KsefAuthException e) {
                log.warn("[OpenSession]:4 Refresh failed for tenant [{}] — falling back to full auth: {}",
                        tenantId, e.getMessage());
            }
        }

        // 3) Full XAdES authentication.
        return authenticateWithCertificate(tenantId, nip);
    }

    public boolean isSessionActive(String tenantId) {
        log.info("[isSessionActive]:1 Checking active session for tenant [{}]", tenantId);
        return sessionStore.getActiveAccessToken(tenantId).isPresent();
    }

    /** Deactivates the local token session for the tenant. */
    public void closeSession(String tenantId) {
        log.info("[closeSession]:1 Deactivating local token session for tenant [{}]", tenantId);
        sessionStore.deactivateSession(tenantId);
        // Record an immutable audit entry for closing the session.
        // We reuse the shared audit service so there is only one place that writes audit logs.
        KSeFAuditLogService.writeAuditLog(
                tenantId, "KSEF_SESSION_CLOSED", "SESSION", null, null, "local deactivation", null, null);
        log.info("[closeSession]:2 Session closed for tenant [{}]", tenantId);
    }

    //! ── Full certificate (XAdES) authentication ──────────────────────────────────

    private String authenticateWithCertificate(String tenantId, String nip) {
        log.info("[authenticateWithCertificate]:1 Starting full XAdES authentication for tenant [{}] nip [{}]",
                tenantId, nip);
        // Guard: certificate must be active before any network calls.
        certificateService.validateCertificateActive(tenantId);
        log.info("[authenticateWithCertificate]:2 Certificate is active for tenant [{}]", tenantId);

        try {
            // Step 1 — challenge
            AuthChallengeResponse challenge = ksefApiClient.getAuthChallenge();
            log.info(
                "[authenticateWithCertificate]:3 Auth challenge obtained for tenant [{}] | Response={} | Challenge={} | Timestamp={}",
                tenantId,
                challenge,
                challenge.challenge(),
                challenge.timestamp()
            );

            //! Step 2 — build + XAdES-sign the AuthTokenRequest
            String unsignedXml = AuthTokenRequestBuilder.buildForNip(challenge.challenge(), nip);
            PrivateKey privateKey = certificateService.getPrivateKey(tenantId);
            X509Certificate cert = certificateService.getPublicCertificate(tenantId);
            String signedXml = xadesSigner.sign(unsignedXml, privateKey, cert);
            log.info("[authenticateWithCertificate]:4 AuthTokenRequest built and XAdES-signed for tenant [{}]", tenantId);

            //! Step 3 — submit signed XML, receive temporary auth operation token
            AuthInitResponse init = ksefApiClient.submitXadesSignature(signedXml);
            String authToken = init.authenticationToken().token();
            log.info("[authenticateWithCertificate]:5 Signed XML submitted — auth ref [{}]", init.referenceNumber());

            // Step 4 — poll until the async auth operation succeeds
            awaitAuthSuccess(init.referenceNumber(), authToken);
            log.info("[authenticateWithCertificate]:6 Auth operation confirmed for tenant [{}]", tenantId);

            // Step 5 — redeem the access + refresh tokens
            AuthTokensResponse tokens = ksefApiClient.redeemTokens(authToken);
            sessionStore.saveSession(tenantId, tokens.accessToken(), tokens.refreshToken());
            certificateService.recordAuthSuccess(tenantId);

            // Record an immutable audit entry for a successful login through the shared audit service.
            KSeFAuditLogService.writeAuditLog(
                    tenantId, "KSEF_SESSION_OPENED", "SESSION", null, null,
                    "environment=" + apiProperties.getEnvironment(), null, null);
            log.info("[authenticateWithCertificate]:7 Authentication complete, tokens stored for tenant [{}]", tenantId);
            return tokens.accessToken().token();

        } catch (KsefAuthException e) {
            log.error("[authenticateWithCertificate]:8 Authentication FAILED for tenant [{}]: {}",
                    tenantId, e.getMessage(), e);
            certificateService.recordAuthFailure(tenantId);
            // Record an immutable audit entry for a failed login through the shared audit service.
            KSeFAuditLogService.writeAuditLog(
                    tenantId, "KSEF_SESSION_FAILED", "SESSION", null, null, e.getMessage(), null, null);
            throw e;
        }
    }

    // Polls GET /auth/{referenceNumber} until the operation reports success or fails.
    private void awaitAuthSuccess(String referenceNumber, String authToken) {
        log.info("[awaitAuthSuccess]:1 Polling auth status for ref [{}]", referenceNumber);
        for (int attempt = 1; attempt <= AUTH_POLL_MAX_ATTEMPTS; attempt++) {
            AuthStatusResponse status = ksefApiClient.getAuthStatus(referenceNumber, authToken);
            Integer code = status.status() != null ? status.status().code() : null;
            log.info("[awaitAuthSuccess]:2 Attempt {}/{} for ref [{}] — status code [{}]",
                    attempt, AUTH_POLL_MAX_ATTEMPTS, referenceNumber, code);

            if (code != null && code == AUTH_STATUS_SUCCESS) {
                log.info("[awaitAuthSuccess]:3 Auth operation [{}] succeeded", referenceNumber);
                return;
            }
            if (code != null && code >= 400) {
                log.error("[awaitAuthSuccess]:4 Auth operation [{}] rejected — code [{}]", referenceNumber, code);
                throw new KsefAuthException("KSeF authentication rejected (code " + code + "): "
                        + (status.status().description() != null ? status.status().description() : ""));
            }
            // Still in progress (e.g. awaiting OCSP/CRL) — wait and retry.
            if (attempt < AUTH_POLL_MAX_ATTEMPTS) {
                sleepQuietly(AUTH_POLL_INTERVAL_MS);
            }
        }
        log.error("[awaitAuthSuccess]:5 Auth did not complete after {} attempts for ref [{}]",
                AUTH_POLL_MAX_ATTEMPTS, referenceNumber);
        throw new KsefAuthException("KSeF authentication did not complete after "
                + AUTH_POLL_MAX_ATTEMPTS + " status checks for ref " + referenceNumber);
    }

    private static void sleepQuietly(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
