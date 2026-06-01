package com.ksefflow.backend.services.ksefauth;

import com.ksefflow.backend.config.KsefApiProperties;
import com.ksefflow.backend.exceptions.KsefAuthException;
import com.ksefflow.backend.models.KsefAuditLog;
import com.ksefflow.backend.models.KsefGovernmentSession;
import com.ksefflow.backend.repository.KsefAuditLogRepository;
import com.ksefflow.backend.repository.KsefGovernmentSessionRepository;
import com.ksefflow.backend.services.certificate.CertificateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.time.LocalDateTime;
import java.util.Optional;

/**
 * KSeF Government API — Challenge-Response Authentication (Phase 2).
 *
 * The 3-step flow to open a government session:
 *
 * Step 1 — POST /online/Session/AuthorisationChallenge
 * Send the company NIP → receive a random challenge string.
 *
 * Step 2 — Sign the challenge locally
 * Load the tenant's active .pfx certificate (via CertificateService).
 * Sign the challenge bytes with SHA256withRSA using the private key.
 * DER-encode and Base64-encode the public certificate.
 *
 * Step 3 — POST /online/Session/Authorisation
 * Send NIP + signed challenge + public certificate.
 * The government verifies the signature and returns a session token.
 *
 * Helper responsibilities:
 * - KsefApiClient — all HTTP calls to the KSeF government REST API
 * - KsefSigningUtils — RSA-SHA256 challenge signing + DER certificate encoding
 * (static)
 * - KsefSessionStore — session token encrypt/save/deactivate in MongoDB
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KSeFAuthService {

    private final CertificateService certificateService;
    private final KsefApiClient ksefApiClient;
    private final KsefSessionStore sessionStore;
    private final KsefGovernmentSessionRepository sessionRepository;
    private final KsefAuditLogRepository auditLogRepository;
    private final KsefApiProperties apiProperties;

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Opens a secure session with the KSeF government system for a company.
     *
     * What happens in this method:
     * 1. Checks if the company already has an active session
     * → if yes, returns the existing session token
     *
     * 2. Checks if the company certificate is valid
     * → makes sure it is not expired or revoked
     *
     * 3. Requests a challenge code from the KSeF government API
     *
     * 4. Signs the challenge using the company’s private certificate key
     *
     * 5. Sends the signed challenge and public certificate to KSeF
     *
     * 6. Receives a session token from KSeF
     * → encrypts and stores it safely in MongoDB
     *
     * 7. Saves audit logs for tracking and compliance
     *
     * @param tenantId company/tenant identifier
     * @param nip      company's 10-digit Polish tax number
     * @return active KSeF session token used in the "SessionToken" HTTP header
     * @throws KsefAuthException if authentication fails at any step
     */
    //KSeF uses Public Key Infrastructure certificate-based authentication (not username/password). 
    public String openSession(String tenantId, String nip) {
        // Return existing session if still valid — avoid unnecessary re-authentication
        Optional<String> existing = sessionStore.getActiveToken(tenantId);

        if (existing.isPresent()) {
            log.debug("Reusing existing active session for tenant [{}]", tenantId);
            return existing.get();
        }
        //! yaha tak.....
        // Guard: validate the certificate before making any network calls
        certificateService.validateCertificateActive(tenantId);

        try {
            //TODO: 1st thing with goverment 
            // Step 1 — request challenge from government
            String challenge = ksefApiClient.requestChallenge(nip);
            log.debug("Received challenge for tenant [{}]", tenantId);

            // Step 2 — sign the challenge and encode the public certificate
            PrivateKey privateKey = certificateService.getPrivateKey(tenantId);
            X509Certificate publicCert = certificateService.getPublicCertificate(tenantId);
            String signedChallenge = KsefSigningUtils.signChallenge(challenge, privateKey);
            String certBase64 = KsefSigningUtils.encodeCertificate(publicCert);

            //TODO: 2nd thing with goverment 
            // Step 3 — submit to government, receive session token
            String sessionToken = ksefApiClient.authorise(nip, signedChallenge, certBase64);
            log.info("Session opened successfully for tenant [{}] in environment [{}]",
                    tenantId, apiProperties.getEnvironment());

            // Persist session (token encrypted at rest)
            sessionStore.saveActiveSession(tenantId, sessionToken);

            certificateService.recordAuthSuccess(tenantId);
            writeAuditLog(tenantId, "KSEF_SESSION_OPENED", "SESSION", null,
                    "environment=" + apiProperties.getEnvironment());

            return sessionToken;

        } catch (KsefAuthException kae) {
            certificateService.recordAuthFailure(tenantId);
            writeAuditLog(tenantId, "KSEF_SESSION_FAILED", "SESSION", null, kae.getMessage());
            throw kae;
        }
    }

    /**
     * Returns the active session token for a tenant if one exists and has not
     * expired.
     * The returned token is decrypted — ready to use as the "SessionToken" HTTP
     * header.
     * Returns Optional.empty() if there is no session or it has expired.
     */
    public Optional<String> getActiveSessionToken(String tenantId) {
        return sessionStore.getActiveToken(tenantId);
    }

    /**
     * Returns true if the tenant has a valid, unexpired government session.
     * Called by KSeFInvoiceService before attempting to submit an invoice.
     */
    public boolean isSessionActive(String tenantId) {
        return sessionStore.getActiveToken(tenantId).isPresent();
    }

    /**
     * Terminates the tenant's active government session.
     *
     * Calls DELETE /online/Session/Terminate on the KSeF API, then deactivates
     * the local session record regardless of API result.
     * If KSeF is unreachable the session will expire naturally after 24 hours.
     */
    public void closeSession(String tenantId) {
        sessionRepository.findByTenantId(tenantId)
                .filter(KsefGovernmentSession::isActive)
                .ifPresent(session -> {
                    // Decrypt token to send in the Terminate request
                    String token = sessionStore.getActiveToken(tenantId).orElse(null);
                    if (token != null) {
                        try {
                            ksefApiClient.terminateSession(token);
                            log.info("Session terminated at KSeF API for tenant [{}]", tenantId);
                        } catch (Exception e) {
                            // Log but do not throw — local cleanup must still happen
                            log.warn("Failed to terminate session at KSeF API for tenant [{}]: {}",
                                    tenantId, e.getMessage());
                        }
                    }
                    sessionStore.deactivateSession(session);
                    writeAuditLog(tenantId, "KSEF_SESSION_CLOSED", "SESSION",
                            session.getId(), "manual termination");
                });
    }

    // ── Domain-level audit log (stays in service — it writes to compliance
    // records) ──

    private void writeAuditLog(String tenantId, String action,
            String entityType, String entityId, String newValue) {
        try {
            auditLogRepository.save(KsefAuditLog.builder()
                    .tenantId(tenantId)
                    .action(action)
                    .targetEntityType(entityType)
                    .targetEntityId(entityId)
                    .newValue(newValue)
                    .complianceChecked(true)
                    .timestamp(LocalDateTime.now())
                    .build());
        } catch (Exception e) {
            // Audit log failure must never block the main operation
            log.error("Failed to write audit log [action={}] for tenant [{}]: {}",
                    action, tenantId, e.getMessage());
        }
    }
}
