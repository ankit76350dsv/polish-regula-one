package com.ksefflow.backend.services.ksefauth;

import com.ksefflow.backend.config.KsefApiProperties;
import com.ksefflow.backend.models.KsefGovernmentSession;
import com.ksefflow.backend.models.utils.KsefGovernmentStatus;
import com.ksefflow.backend.repository.KsefGovernmentSessionRepository;
import com.ksefflow.backend.services.certificate.CertificateCryptoUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

// Handles KsefGovernmentSession read/write in MongoDB.
// One session document per tenant — upserted on every open/close (not appended).
// The session token is AES-256-GCM encrypted before storage via CertificateCryptoUtils.
@Component
@RequiredArgsConstructor
public class KsefSessionStore {

    // KSeF enforces a maximum session lifetime of 24 hours.
    // We track this locally so we do not attempt to use an expired token.
    private static final int SESSION_LIFETIME_HOURS = 24;

    private final KsefGovernmentSessionRepository ksef_government_sessions_repo;
    private final KsefApiProperties apiProperties;
    private final CertificateCryptoUtils crypto;

    // Saves (or updates) the government session for a tenant.
    // The session token is encrypted before being written to MongoDB.
    // Uses find-then-update (upsert) so only one document exists per tenant.
    public void saveActiveSession(String tenantId, String plainSessionToken) {
        String encryptedToken = crypto.encryptPassword(plainSessionToken);

        KsefGovernmentSession session = ksef_government_sessions_repo.findByTenantId(tenantId)
                .orElse(KsefGovernmentSession.builder()
                        .tenantId(tenantId)
                        .createdAt(LocalDateTime.now())
                        .build());

        session.setActive(true);
        session.setEnvironment(apiProperties.getEnvironment());
        session.setSessionToken(encryptedToken);
        session.setStatus(KsefGovernmentStatus.CONNECTED);
        session.setSessionStartedAt(LocalDateTime.now());
        session.setSessionExpiresAt(LocalDateTime.now().plusHours(SESSION_LIFETIME_HOURS));
        session.setLastSyncTime(LocalDateTime.now());
        session.setUpdatedAt(LocalDateTime.now());

        ksef_government_sessions_repo.save(session);
    }

    // Marks the session as inactive and clears the encrypted token.
    // Called after a successful /Terminate API call, or on forced local cleanup.
    public void deactivateSession(KsefGovernmentSession session) {
        session.setActive(false);
        session.setStatus(KsefGovernmentStatus.DISCONNECTED);
        session.setSessionToken(null);
        session.setUpdatedAt(LocalDateTime.now());
        ksef_government_sessions_repo.save(session);
    }

    // Returns the decrypted session token if the session is active and not expired.
    // Returns an empty Optional if there is no session or it has expired.
    public java.util.Optional<String> getActiveToken(String tenantId) {
        return ksef_government_sessions_repo.findByTenantId(tenantId)
                .filter(KsefGovernmentSession::isActive)
                .filter(s -> s.getSessionExpiresAt() != null
                        && s.getSessionExpiresAt().isAfter(LocalDateTime.now()))
                .map(s -> crypto.decryptPassword(s.getSessionToken()));
    }
}
