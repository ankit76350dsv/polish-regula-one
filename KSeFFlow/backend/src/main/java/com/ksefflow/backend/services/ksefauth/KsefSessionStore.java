package com.ksefflow.backend.services.ksefauth;

import com.ksefflow.backend.config.KsefApiProperties;
import com.ksefflow.backend.dto.ksefapi.TokenInfo;
import com.ksefflow.backend.models.KsefGovernmentSession;
import com.ksefflow.backend.models.utils.KsefGovernmentStatus;
import com.ksefflow.backend.repository.KsefGovernmentSessionRepository;
import com.ksefflow.backend.services.certificate.CertificateCryptoUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Optional;

/**
 * Persists the KSeF 2.0 token pair (accessToken + refreshToken) per tenant in MongoDB.
 * One document per tenant, upserted on every authentication. Both tokens are
 * AES-256-GCM encrypted before storage via {@link CertificateCryptoUtils}.
 *
 * <p>The accessToken is short-lived (minutes); the refreshToken lives up to 7 days and is
 * used to mint fresh accessTokens without re-running the XAdES authentication.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class KsefSessionStore {

    // Fallback lifetimes used only when KSeF does not return a parseable validUntil.
    private static final int ACCESS_FALLBACK_MINUTES = 10;
    private static final int REFRESH_FALLBACK_HOURS = 24;

    private final KsefGovernmentSessionRepository sessionRepository;
    private final KsefApiProperties apiProperties;
    private final CertificateCryptoUtils crypto;

    /** Saves (upserts) both tokens for a tenant, encrypting each at rest. */
    public void saveSession(String tenantId, TokenInfo accessToken, TokenInfo refreshToken) {
        KsefGovernmentSession session = sessionRepository.findByTenantId(tenantId)
                .orElse(KsefGovernmentSession.builder()
                        .tenantId(tenantId)
                        .createdAt(LocalDateTime.now())
                        .build());

        session.setActive(true);
        session.setEnvironment(apiProperties.getEnvironment());
        session.setStatus(KsefGovernmentStatus.CONNECTED);
        session.setSessionToken(crypto.encryptPassword(accessToken.token()));
        session.setSessionStartedAt(LocalDateTime.now());
        session.setSessionExpiresAt(parseOrDefault(accessToken.validUntil(),
                LocalDateTime.now().plusMinutes(ACCESS_FALLBACK_MINUTES)));

        if (refreshToken != null && refreshToken.token() != null) {
            session.setRefreshToken(crypto.encryptPassword(refreshToken.token()));
            session.setRefreshTokenExpiresAt(parseOrDefault(refreshToken.validUntil(),
                    LocalDateTime.now().plusHours(REFRESH_FALLBACK_HOURS)));
        }

        session.setLastSyncTime(LocalDateTime.now());
        session.setUpdatedAt(LocalDateTime.now());
        sessionRepository.save(session);
    }

    /** Replaces just the accessToken after a successful /auth/token/refresh. */
    public void updateAccessToken(String tenantId, TokenInfo accessToken) {
        sessionRepository.findByTenantId(tenantId).ifPresent(session -> {
            session.setSessionToken(crypto.encryptPassword(accessToken.token()));
            session.setSessionExpiresAt(parseOrDefault(accessToken.validUntil(),
                    LocalDateTime.now().plusMinutes(ACCESS_FALLBACK_MINUTES)));
            session.setLastSyncTime(LocalDateTime.now());
            session.setUpdatedAt(LocalDateTime.now());
            sessionRepository.save(session);
        });
    }

    /** Returns the decrypted accessToken if the session is active and the token is unexpired. */
    public Optional<String> getActiveAccessToken(String tenantId) {
        return sessionRepository.findByTenantId(tenantId)
                .filter(KsefGovernmentSession::isActive)
                .filter(s -> s.getSessionToken() != null)
                .filter(s -> s.getSessionExpiresAt() != null
                        && s.getSessionExpiresAt().isAfter(LocalDateTime.now()))
                .map(s -> crypto.decryptPassword(s.getSessionToken()));
    }

    /** Returns the decrypted refreshToken if active and the refresh window is still open. */
    public Optional<String> getValidRefreshToken(String tenantId) {
        return sessionRepository.findByTenantId(tenantId)
                .filter(KsefGovernmentSession::isActive)
                .filter(s -> s.getRefreshToken() != null)
                .filter(s -> s.getRefreshTokenExpiresAt() != null
                        && s.getRefreshTokenExpiresAt().isAfter(LocalDateTime.now()))
                .map(s -> crypto.decryptPassword(s.getRefreshToken()));
    }

    /** Marks the session inactive and clears both tokens. */
    public void deactivateSession(String tenantId) {
        sessionRepository.findByTenantId(tenantId).ifPresent(session -> {
            session.setActive(false);
            session.setStatus(KsefGovernmentStatus.DISCONNECTED);
            session.setSessionToken(null);
            session.setRefreshToken(null);
            session.setUpdatedAt(LocalDateTime.now());
            sessionRepository.save(session);
        });
    }

    private static LocalDateTime parseOrDefault(String iso, LocalDateTime fallback) {
        if (iso == null || iso.isBlank()) {
            return fallback;
        }
        try {
            // KSeF returns an offset date-time (e.g. 2026-06-08T12:34:56Z); normalise to local.
            return OffsetDateTime.parse(iso, DateTimeFormatter.ISO_DATE_TIME).toLocalDateTime();
        } catch (Exception e) {
            try {
                return LocalDateTime.parse(iso, DateTimeFormatter.ISO_DATE_TIME);
            } catch (Exception ignored) {
                return fallback;
            }
        }
    }
}
