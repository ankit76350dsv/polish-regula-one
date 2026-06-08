package com.ksefflow.backend.services;

import com.ksefflow.backend.config.KsefApiProperties;
import com.ksefflow.backend.dto.ksefapi.AuthChallengeResponse;
import com.ksefflow.backend.dto.ksefapi.AuthInitResponse;
import com.ksefflow.backend.dto.ksefapi.AuthStatusResponse;
import com.ksefflow.backend.dto.ksefapi.AuthTokenRefreshResponse;
import com.ksefflow.backend.dto.ksefapi.AuthTokensResponse;
import com.ksefflow.backend.dto.ksefapi.StatusInfo;
import com.ksefflow.backend.dto.ksefapi.TokenInfo;
import com.ksefflow.backend.exceptions.KsefAuthException;
import com.ksefflow.backend.exceptions.KsefCertificateException;
import com.ksefflow.backend.models.utils.KsefEnvironment;
import com.ksefflow.backend.repository.KsefAuditLogRepository;
import com.ksefflow.backend.services.certificate.CertificateService;
import com.ksefflow.backend.services.ksefauth.KSeFAuthService;
import com.ksefflow.backend.services.ksefauth.KsefApiClient;
import com.ksefflow.backend.services.ksefauth.KsefSessionStore;
import com.ksefflow.backend.services.ksefauth.XAdESSigner;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

// Unit test for the KSeF 2.0 token-based authentication flow — all HTTP, signing and
// persistence collaborators are mocked (the XAdES signer is mocked, so no real PFX needed).
@ExtendWith(MockitoExtension.class)
class KSeFAuthServiceTest {

    private static final String TENANT_ID      = "tenant-pl-001";
    private static final String NIP            = "1234567890";
    private static final String CHALLENGE      = "20260608-CR-AB12CD34EF-1122334455-AB";
    private static final String AUTH_TOKEN     = "eyJhbGciOiJSUzI1NiJ9.AUTH_OP";
    private static final String ACCESS_TOKEN   = "eyJhbGciOiJSUzI1NiJ9.ACCESS";
    private static final String REFRESH_TOKEN  = "eyJhbGciOiJSUzI1NiJ9.REFRESH";
    private static final int    SUCCESS_CODE    = 200;

    @Mock private CertificateService certificateService;
    @Mock private KsefApiClient apiClient;
    @Mock private KsefSessionStore sessionStore;
    @Mock private XAdESSigner xadesSigner;
    @Mock private KsefAuditLogRepository auditLogRepository;
    @Mock private KsefApiProperties apiProperties;

    @InjectMocks
    private KSeFAuthService authService;

    // ── openSession: full XAdES authentication ────────────────────────────────────

    @Test
    @DisplayName("openSession: full flow (challenge → sign → submit → poll → redeem) returns accessToken")
    void openSession_fullFlow_returnsAccessToken() {
        when(sessionStore.getActiveAccessToken(TENANT_ID)).thenReturn(Optional.empty());
        when(sessionStore.getValidRefreshToken(TENANT_ID)).thenReturn(Optional.empty());
        doNothing().when(certificateService).validateCertificateActive(TENANT_ID);

        when(apiClient.getAuthChallenge())
                .thenReturn(new AuthChallengeResponse(CHALLENGE, "2026-06-08T12:00:00Z", 1L, "1.2.3.4"));
        when(xadesSigner.sign(anyString(), any(), any())).thenReturn("<signed/>");
        when(apiClient.submitXadesSignature("<signed/>"))
                .thenReturn(new AuthInitResponse("ref-001", new TokenInfo(AUTH_TOKEN, "2026-06-08T12:10:00Z")));
        when(apiClient.getAuthStatus("ref-001", AUTH_TOKEN))
                .thenReturn(new AuthStatusResponse("2026-06-08T12:00:01Z", "QualifiedSignature", "info",
                        new StatusInfo(SUCCESS_CODE, "Uwierzytelnianie zakończone sukcesem", null),
                        false, null, null));
        when(apiClient.redeemTokens(AUTH_TOKEN)).thenReturn(new AuthTokensResponse(
                new TokenInfo(ACCESS_TOKEN, "2026-06-08T12:15:00Z"),
                new TokenInfo(REFRESH_TOKEN, "2026-06-15T12:00:00Z")));
        when(apiProperties.getEnvironment()).thenReturn(KsefEnvironment.SANDBOX);

        String token = authService.openSession(TENANT_ID, NIP);

        assertThat(token).isEqualTo(ACCESS_TOKEN);
        verify(apiClient).getAuthChallenge();
        verify(xadesSigner).sign(anyString(), any(), any());
        verify(apiClient).submitXadesSignature("<signed/>");
        verify(apiClient).redeemTokens(AUTH_TOKEN);
        verify(sessionStore).saveSession(eq(TENANT_ID), any(), any());
        verify(certificateService).recordAuthSuccess(TENANT_ID);
        verify(auditLogRepository).save(argThat(l ->
                "KSEF_SESSION_OPENED".equals(l.getAction()) && TENANT_ID.equals(l.getTenantId())));
    }

    @Test
    @DisplayName("openSession: reuses a valid accessToken without any government call")
    void openSession_validAccessToken_reusedWithoutApiCall() {
        when(sessionStore.getActiveAccessToken(TENANT_ID)).thenReturn(Optional.of(ACCESS_TOKEN));

        String token = authService.openSession(TENANT_ID, NIP);

        assertThat(token).isEqualTo(ACCESS_TOKEN);
        verify(apiClient, never()).getAuthChallenge();
        verify(apiClient, never()).redeemTokens(any());
        verify(certificateService, never()).validateCertificateActive(any());
    }

    @Test
    @DisplayName("openSession: refreshes the accessToken using a valid refreshToken (no full re-auth)")
    void openSession_validRefreshToken_refreshesInsteadOfReauth() {
        when(sessionStore.getActiveAccessToken(TENANT_ID)).thenReturn(Optional.empty());
        when(sessionStore.getValidRefreshToken(TENANT_ID)).thenReturn(Optional.of(REFRESH_TOKEN));
        when(apiClient.refreshAccessToken(REFRESH_TOKEN))
                .thenReturn(new AuthTokenRefreshResponse(new TokenInfo(ACCESS_TOKEN, "2026-06-08T12:30:00Z")));

        String token = authService.openSession(TENANT_ID, NIP);

        assertThat(token).isEqualTo(ACCESS_TOKEN);
        verify(sessionStore).updateAccessToken(eq(TENANT_ID), any());
        // Full XAdES authentication must NOT run.
        verify(apiClient, never()).getAuthChallenge();
        verify(certificateService, never()).validateCertificateActive(any());
    }

    @Test
    @DisplayName("openSession: throws before any government call when the certificate is invalid")
    void openSession_invalidCertificate_throwsBeforeApiCall() {
        when(sessionStore.getActiveAccessToken(TENANT_ID)).thenReturn(Optional.empty());
        when(sessionStore.getValidRefreshToken(TENANT_ID)).thenReturn(Optional.empty());
        doThrow(new KsefCertificateException("Certificate expired"))
                .when(certificateService).validateCertificateActive(TENANT_ID);

        assertThatThrownBy(() -> authService.openSession(TENANT_ID, NIP))
                .isInstanceOf(KsefCertificateException.class)
                .hasMessageContaining("Certificate expired");

        verify(apiClient, never()).getAuthChallenge();
    }

    @Test
    @DisplayName("openSession: records failure and throws when KSeF rejects the authentication")
    void openSession_authRejected_recordsFailureAndThrows() {
        when(sessionStore.getActiveAccessToken(TENANT_ID)).thenReturn(Optional.empty());
        when(sessionStore.getValidRefreshToken(TENANT_ID)).thenReturn(Optional.empty());
        doNothing().when(certificateService).validateCertificateActive(TENANT_ID);

        when(apiClient.getAuthChallenge())
                .thenReturn(new AuthChallengeResponse(CHALLENGE, "2026-06-08T12:00:00Z", 1L, "1.2.3.4"));
        when(xadesSigner.sign(anyString(), any(), any())).thenReturn("<signed/>");
        when(apiClient.submitXadesSignature("<signed/>"))
                .thenReturn(new AuthInitResponse("ref-001", new TokenInfo(AUTH_TOKEN, "2026-06-08T12:10:00Z")));
        when(apiClient.getAuthStatus("ref-001", AUTH_TOKEN))
                .thenReturn(new AuthStatusResponse("2026-06-08T12:00:01Z", "QualifiedSignature", "info",
                        new StatusInfo(401, "Brak uprawnień", null), false, null, null));

        assertThatThrownBy(() -> authService.openSession(TENANT_ID, NIP))
                .isInstanceOf(KsefAuthException.class)
                .hasMessageContaining("401");

        verify(certificateService).recordAuthFailure(TENANT_ID);
        verify(apiClient, never()).redeemTokens(any());
        verify(auditLogRepository).save(argThat(l -> "KSEF_SESSION_FAILED".equals(l.getAction())));
    }

    // ── isSessionActive ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("isSessionActive: true when a valid accessToken exists")
    void isSessionActive_validToken_true() {
        when(sessionStore.getActiveAccessToken(TENANT_ID)).thenReturn(Optional.of(ACCESS_TOKEN));
        assertThat(authService.isSessionActive(TENANT_ID)).isTrue();
    }

    @Test
    @DisplayName("isSessionActive: false when there is no token")
    void isSessionActive_noToken_false() {
        when(sessionStore.getActiveAccessToken(TENANT_ID)).thenReturn(Optional.empty());
        assertThat(authService.isSessionActive(TENANT_ID)).isFalse();
    }

    // ── closeSession ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("closeSession: deactivates the local token session and writes an audit entry")
    void closeSession_deactivatesAndAudits() {
        authService.closeSession(TENANT_ID);

        verify(sessionStore).deactivateSession(TENANT_ID);
        verify(auditLogRepository).save(argThat(l -> "KSEF_SESSION_CLOSED".equals(l.getAction())));
    }
}
