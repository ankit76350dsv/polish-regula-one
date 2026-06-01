package com.ksefflow.backend.services;

import com.ksefflow.backend.services.certificate.CertificateService;

import com.ksefflow.backend.config.KsefApiProperties;
import com.ksefflow.backend.exceptions.KsefAuthException;
import com.ksefflow.backend.exceptions.KsefCertificateException;
import com.ksefflow.backend.models.KsefGovernmentSession;
import com.ksefflow.backend.models.utils.KsefEnvironment;
import com.ksefflow.backend.models.utils.KsefGovernmentStatus;
import com.ksefflow.backend.repository.KsefAuditLogRepository;
import com.ksefflow.backend.repository.KsefGovernmentSessionRepository;
import com.ksefflow.backend.services.ksefauthutils.KsefApiClient;
import com.ksefflow.backend.services.ksefauthutils.KsefSessionStore;
import com.ksefflow.backend.services.certificate.KeyStoreUtils;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.InputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

// Unit test for KSeFAuthService — all HTTP and MongoDB calls are mocked.
// Tests that need RSA signing use a real PrivateKey loaded from the test .pfx
// because Mockito proxies are not valid Java security keys.
@ExtendWith(MockitoExtension.class)
class KSeFAuthServiceTest {

    private static final String TENANT_ID      = "tenant-pl-001";
    private static final String NIP            = "1234567890";
    private static final String FAKE_CHALLENGE = "20260525-CR-ABCDEF123456";
    private static final String FAKE_TOKEN     = "eyJhbGciOiJSUzI1NiJ9.FAKE_KSEF_SESSION_TOKEN";
    private static final String PFX_PASSWORD   = "KSeFTest2024!";

    @Mock private CertificateService certificateService;
    @Mock private KsefApiClient apiClient;
    @Mock private KsefSessionStore sessionStore;
    @Mock private KsefGovernmentSessionRepository sessionRepository;
    @Mock private KsefAuditLogRepository auditLogRepository;
    @Mock private KsefApiProperties apiProperties;

    @InjectMocks
    private KSeFAuthService authService;

    // ── openSession ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("openSession: full 3-step flow works when no existing session")
    void openSession_noExistingSession_completesFullAuthFlow() throws Exception {
        // No existing session
        when(sessionStore.getActiveToken(TENANT_ID)).thenReturn(Optional.empty());
        doNothing().when(certificateService).validateCertificateActive(TENANT_ID);

        // Use REAL key/cert from test .pfx — Mockito proxy fails Java crypto
        when(certificateService.getPrivateKey(TENANT_ID)).thenReturn(loadRealPrivateKey());
        when(certificateService.getPublicCertificate(TENANT_ID)).thenReturn(loadRealCert());

        when(apiClient.requestChallenge(NIP)).thenReturn(FAKE_CHALLENGE);
        when(apiClient.authorise(eq(NIP), anyString(), anyString())).thenReturn(FAKE_TOKEN);
        when(apiProperties.getEnvironment()).thenReturn(KsefEnvironment.SANDBOX);

        String token = authService.openSession(TENANT_ID, NIP);

        assertThat(token).isEqualTo(FAKE_TOKEN);

        // Verify 3-step flow happened in the right order
        verify(apiClient).requestChallenge(NIP);
        verify(certificateService).getPrivateKey(TENANT_ID);
        verify(certificateService).getPublicCertificate(TENANT_ID);
        verify(apiClient).authorise(eq(NIP), anyString(), anyString());

        // Session saved and cert success recorded
        verify(sessionStore).saveActiveSession(TENANT_ID, FAKE_TOKEN);
        verify(certificateService).recordAuthSuccess(TENANT_ID);

        // Audit log written
        verify(auditLogRepository).save(argThat(log ->
                "KSEF_SESSION_OPENED".equals(log.getAction()) && TENANT_ID.equals(log.getTenantId())));
    }

    @Test
    @DisplayName("openSession: reuses existing session without re-authenticating")
    void openSession_existingActiveSession_returnsExistingTokenWithoutApiCall() {
        when(sessionStore.getActiveToken(TENANT_ID)).thenReturn(Optional.of(FAKE_TOKEN));

        String token = authService.openSession(TENANT_ID, NIP);

        assertThat(token).isEqualTo(FAKE_TOKEN);

        // Government API NOT called — no unnecessary re-auth
        verify(apiClient, never()).requestChallenge(any());
        verify(apiClient, never()).authorise(any(), any(), any());
        verify(certificateService, never()).validateCertificateActive(any());
    }

    @Test
    @DisplayName("openSession: throws before API call when certificate is invalid")
    void openSession_invalidCertificate_throwsBeforeAnyApiCall() {
        when(sessionStore.getActiveToken(TENANT_ID)).thenReturn(Optional.empty());
        doThrow(new KsefCertificateException("Certificate expired"))
                .when(certificateService).validateCertificateActive(TENANT_ID);

        assertThatThrownBy(() -> authService.openSession(TENANT_ID, NIP))
                .isInstanceOf(KsefCertificateException.class)
                .hasMessageContaining("Certificate expired");

        // Government API never reached
        verify(apiClient, never()).requestChallenge(any());
    }

    @Test
    @DisplayName("openSession: records failure and re-throws when government rejects signature")
    void openSession_governmentRejectsSignature_recordsFailureAndThrows() throws Exception {
        when(sessionStore.getActiveToken(TENANT_ID)).thenReturn(Optional.empty());
        doNothing().when(certificateService).validateCertificateActive(TENANT_ID);

        // Real key needed — signing happens before authorise() is called
        when(certificateService.getPrivateKey(TENANT_ID)).thenReturn(loadRealPrivateKey());
        when(certificateService.getPublicCertificate(TENANT_ID)).thenReturn(loadRealCert());

        when(apiClient.requestChallenge(NIP)).thenReturn(FAKE_CHALLENGE);
        when(apiClient.authorise(eq(NIP), anyString(), anyString()))
                .thenThrow(new KsefAuthException("KSeF authorisation failed [401]: invalid signature"));

        assertThatThrownBy(() -> authService.openSession(TENANT_ID, NIP))
                .isInstanceOf(KsefAuthException.class)
                .hasMessageContaining("invalid signature");

        verify(certificateService).recordAuthFailure(TENANT_ID);
        verify(auditLogRepository).save(argThat(log -> "KSEF_SESSION_FAILED".equals(log.getAction())));
    }

    @Test
    @DisplayName("openSession: records failure when KSeF API is unreachable (challenge step)")
    void openSession_apiUnreachable_recordsFailureAndThrows() {
        when(sessionStore.getActiveToken(TENANT_ID)).thenReturn(Optional.empty());
        doNothing().when(certificateService).validateCertificateActive(TENANT_ID);

        // Network timeout at the challenge step — getPrivateKey is never reached
        when(apiClient.requestChallenge(NIP))
                .thenThrow(new KsefAuthException("KSeF API is unreachable — check network or consider offline mode"));

        assertThatThrownBy(() -> authService.openSession(TENANT_ID, NIP))
                .isInstanceOf(KsefAuthException.class)
                .hasMessageContaining("unreachable");

        verify(certificateService).recordAuthFailure(TENANT_ID);
    }

    // ── isSessionActive ───────────────────────────────────────────────────────

    @Test
    @DisplayName("isSessionActive: returns true when valid session exists")
    void isSessionActive_validSession_returnsTrue() {
        when(sessionStore.getActiveToken(TENANT_ID)).thenReturn(Optional.of(FAKE_TOKEN));
        assertThat(authService.isSessionActive(TENANT_ID)).isTrue();
    }

    @Test
    @DisplayName("isSessionActive: returns false when no session exists")
    void isSessionActive_noSession_returnsFalse() {
        when(sessionStore.getActiveToken(TENANT_ID)).thenReturn(Optional.empty());
        assertThat(authService.isSessionActive(TENANT_ID)).isFalse();
    }

    // ── closeSession ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("closeSession: terminates at API and deactivates local session record")
    void closeSession_activeSession_terminatesAndDeactivatesLocally() {
        KsefGovernmentSession session = buildActiveSession("session-id-001");
        when(sessionRepository.findByTenantId(TENANT_ID)).thenReturn(Optional.of(session));
        when(sessionStore.getActiveToken(TENANT_ID)).thenReturn(Optional.of(FAKE_TOKEN));
        doNothing().when(apiClient).terminateSession(FAKE_TOKEN);

        authService.closeSession(TENANT_ID);

        verify(apiClient).terminateSession(FAKE_TOKEN);
        verify(sessionStore).deactivateSession(session);
        verify(auditLogRepository).save(argThat(log -> "KSEF_SESSION_CLOSED".equals(log.getAction())));
    }

    @Test
    @DisplayName("closeSession: still deactivates locally when KSeF API is unreachable")
    void closeSession_apiUnreachable_stillDeactivatesLocally() {
        KsefGovernmentSession session = buildActiveSession("session-id-002");
        when(sessionRepository.findByTenantId(TENANT_ID)).thenReturn(Optional.of(session));
        when(sessionStore.getActiveToken(TENANT_ID)).thenReturn(Optional.of(FAKE_TOKEN));
        doThrow(new KsefAuthException("network error")).when(apiClient).terminateSession(any());

        // Must NOT throw — local cleanup always happens regardless of API failure
        assertThatCode(() -> authService.closeSession(TENANT_ID)).doesNotThrowAnyException();

        verify(sessionStore).deactivateSession(session);
    }

    @Test
    @DisplayName("closeSession: does nothing when there is no active session")
    void closeSession_noSession_doesNothing() {
        when(sessionRepository.findByTenantId(TENANT_ID)).thenReturn(Optional.empty());

        authService.closeSession(TENANT_ID);

        verify(apiClient, never()).terminateSession(any());
        verify(sessionStore, never()).deactivateSession(any());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private PrivateKey loadRealPrivateKey() throws Exception {
        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (InputStream is = getClass().getClassLoader()
                .getResourceAsStream("ksefflow_sandbox_test.pfx")) {
            ks.load(is, PFX_PASSWORD.toCharArray());
        }
        return KeyStoreUtils.extractPrivateKey(ks, PFX_PASSWORD);
    }

    private X509Certificate loadRealCert() throws Exception {
        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (InputStream is = getClass().getClassLoader()
                .getResourceAsStream("ksefflow_sandbox_test.pfx")) {
            ks.load(is, PFX_PASSWORD.toCharArray());
        }
        return KeyStoreUtils.extractX509Certificate(ks);
    }

    private KsefGovernmentSession buildActiveSession(String id) {
        return KsefGovernmentSession.builder()
                .id(id)
                .tenantId(TENANT_ID)
                .active(true)
                .status(KsefGovernmentStatus.CONNECTED)
                .sessionToken("local:encrypted-token")
                .sessionExpiresAt(LocalDateTime.now().plusHours(20))
                .build();
    }
}
