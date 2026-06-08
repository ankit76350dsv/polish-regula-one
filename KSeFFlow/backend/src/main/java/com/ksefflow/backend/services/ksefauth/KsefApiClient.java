package com.ksefflow.backend.services.ksefauth;

import com.ksefflow.backend.config.KsefApiProperties;
import com.ksefflow.backend.dto.ksefapi.*;
import com.ksefflow.backend.exceptions.KsefAuthException;
import com.ksefflow.backend.exceptions.KsefSubmissionException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Optional;

/**
 * HTTP client for the <b>KSeF 2.0</b> government REST API (base URL ends with {@code /v2}).
 * Each method maps to exactly one endpoint. The legacy KSeF 1.0 endpoints
 * ({@code /online/Session/*}, {@code documentType=FA(2)}) have been removed.
 *
 * <p>Authentication is token-based: most calls carry {@code Authorization: Bearer <token>}
 * — the temporary {@code authenticationToken} for the redeem/status calls, the
 * {@code refreshToken} for refresh, and the {@code accessToken} for session/invoice calls.
 *
 * <p>Non-2xx / network failures are translated to {@link KsefAuthException} (auth phase) or
 * {@link KsefSubmissionException} (session/invoice phase) so callers stay HTTP-agnostic.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class KsefApiClient {

    private final KsefApiProperties apiProperties;
    private final RestTemplate ksefRestTemplate;

    private String base() {
        return apiProperties.getActiveBaseUrl();
    }

    // ── Authentication ───────────────────────────────────────────────────────────

    /** POST /auth/challenge — fetches a 10-minute challenge (no body, public endpoint). */
    public AuthChallengeResponse getAuthChallenge() {
        String url = base() + "/auth/challenge";
        log.info("[KSeF2] POST {} — requesting auth challenge", url);
        try {
            ResponseEntity<AuthChallengeResponse> resp = ksefRestTemplate.postForEntity(
                    url, HttpEntity.EMPTY, AuthChallengeResponse.class);
            if (resp.getBody() == null || resp.getBody().challenge() == null) {
                throw new KsefAuthException("KSeF returned an empty auth challenge from " + url);
            }
            return resp.getBody();
        } catch (HttpStatusCodeException e) {
            throw new KsefAuthException("KSeF auth challenge failed [" + e.getStatusCode() + "]: "
                    + e.getResponseBodyAsString(), e);
        } catch (ResourceAccessException e) {
            throw new KsefAuthException("KSeF API unreachable at " + url, e);
        }
    }

    /**
     * POST /auth/xades-signature — submits the XAdES-signed AuthTokenRequest XML.
     * Returns the temporary {@code authenticationToken} + {@code referenceNumber} (202, async).
     */
    public AuthInitResponse submitXadesSignature(String signedXml) {
        String url = base() + "/auth/xades-signature";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_XML);
        log.info("[KSeF2] POST {} — submitting XAdES-signed AuthTokenRequest ({} bytes)",
                url, signedXml.length());
        try {
            ResponseEntity<AuthInitResponse> resp = ksefRestTemplate.postForEntity(
                    url, new HttpEntity<>(signedXml, headers), AuthInitResponse.class);
            AuthInitResponse body = resp.getBody();
            if (body == null || body.authenticationToken() == null || body.referenceNumber() == null) {
                throw new KsefAuthException("KSeF auth init response missing token/referenceNumber from " + url);
            }
            return body;
        } catch (HttpStatusCodeException e) {
            throw new KsefAuthException("KSeF XAdES auth submission failed [" + e.getStatusCode() + "]: "
                    + e.getResponseBodyAsString(), e);
        } catch (ResourceAccessException e) {
            throw new KsefAuthException("KSeF API unreachable at " + url, e);
        }
    }

    /** GET /auth/{referenceNumber} — status of the async auth operation (Bearer authenticationToken). */
    public AuthStatusResponse getAuthStatus(String referenceNumber, String authenticationToken) {
        String url = base() + "/auth/" + referenceNumber;
        try {
            ResponseEntity<AuthStatusResponse> resp = ksefRestTemplate.exchange(
                    url, HttpMethod.GET, bearer(authenticationToken), AuthStatusResponse.class);
            if (resp.getBody() == null || resp.getBody().status() == null) {
                throw new KsefAuthException("KSeF auth status response was empty for ref " + referenceNumber);
            }
            return resp.getBody();
        } catch (HttpStatusCodeException e) {
            throw new KsefAuthException("KSeF auth status check failed [" + e.getStatusCode() + "]: "
                    + e.getResponseBodyAsString(), e);
        } catch (ResourceAccessException e) {
            throw new KsefAuthException("KSeF API unreachable at " + url, e);
        }
    }

    /** POST /auth/token/redeem — exchanges the authenticationToken for access + refresh tokens. */
    public AuthTokensResponse redeemTokens(String authenticationToken) {
        String url = base() + "/auth/token/redeem";
        try {
            ResponseEntity<AuthTokensResponse> resp = ksefRestTemplate.exchange(
                    url, HttpMethod.POST, bearer(authenticationToken), AuthTokensResponse.class);
            AuthTokensResponse body = resp.getBody();
            if (body == null || body.accessToken() == null || body.accessToken().token() == null) {
                throw new KsefAuthException("KSeF token redeem returned no accessToken from " + url);
            }
            return body;
        } catch (HttpStatusCodeException e) {
            throw new KsefAuthException("KSeF token redeem failed [" + e.getStatusCode() + "]: "
                    + e.getResponseBodyAsString(), e);
        } catch (ResourceAccessException e) {
            throw new KsefAuthException("KSeF API unreachable at " + url, e);
        }
    }

    /** POST /auth/token/refresh — mints a fresh accessToken (Bearer refreshToken). */
    public AuthTokenRefreshResponse refreshAccessToken(String refreshToken) {
        String url = base() + "/auth/token/refresh";
        try {
            ResponseEntity<AuthTokenRefreshResponse> resp = ksefRestTemplate.exchange(
                    url, HttpMethod.POST, bearer(refreshToken), AuthTokenRefreshResponse.class);
            if (resp.getBody() == null || resp.getBody().accessToken() == null) {
                throw new KsefAuthException("KSeF token refresh returned no accessToken from " + url);
            }
            return resp.getBody();
        } catch (HttpStatusCodeException e) {
            throw new KsefAuthException("KSeF token refresh failed [" + e.getStatusCode() + "]: "
                    + e.getResponseBodyAsString(), e);
        } catch (ResourceAccessException e) {
            throw new KsefAuthException("KSeF API unreachable at " + url, e);
        }
    }

    // ── Security / encryption keys ─────────────────────────────────────────────────

    /** GET /security/public-key-certificates — MF public keys used to wrap the session AES key. */
    public List<PublicKeyCertificate> getPublicKeyCertificates() {
        String url = base() + "/security/public-key-certificates";
        try {
            ResponseEntity<List<PublicKeyCertificate>> resp = ksefRestTemplate.exchange(
                    url, HttpMethod.GET, HttpEntity.EMPTY,
                    new ParameterizedTypeReference<List<PublicKeyCertificate>>() {});
            List<PublicKeyCertificate> body = resp.getBody();
            if (body == null || body.isEmpty()) {
                throw new KsefSubmissionException("KSeF returned no public-key certificates from " + url);
            }
            return body;
        } catch (HttpStatusCodeException e) {
            throw new KsefSubmissionException("KSeF public-key fetch failed [" + e.getStatusCode() + "]: "
                    + e.getResponseBodyAsString(), e);
        } catch (ResourceAccessException e) {
            throw new KsefSubmissionException("KSeF API unreachable at " + url, e);
        }
    }

    // ── Online session + invoice ───────────────────────────────────────────────────

    /** POST /sessions/online — opens an encrypted online session (Bearer accessToken). */
    public OpenOnlineSessionResponse openOnlineSession(String accessToken, OpenOnlineSessionRequest request) {
        String url = base() + "/sessions/online";
        try {
            ResponseEntity<OpenOnlineSessionResponse> resp = ksefRestTemplate.exchange(
                    url, HttpMethod.POST, bearerJson(accessToken, request), OpenOnlineSessionResponse.class);
            OpenOnlineSessionResponse body = resp.getBody();
            if (body == null || body.referenceNumber() == null) {
                throw new KsefSubmissionException("KSeF online-session open returned no referenceNumber from " + url);
            }
            return body;
        } catch (HttpStatusCodeException e) {
            throw new KsefSubmissionException("KSeF online-session open failed [" + e.getStatusCode() + "]: "
                    + e.getResponseBodyAsString(), e);
        } catch (ResourceAccessException e) {
            throw new KsefSubmissionException("KSeF API unreachable at " + url, e);
        }
    }

    /** POST /sessions/online/{ref}/invoices — sends one encrypted invoice (Bearer accessToken). */
    public SendInvoiceResponse sendInvoice(String accessToken, String sessionReference, SendInvoiceRequest request) {
        String url = base() + "/sessions/online/" + sessionReference + "/invoices";
        try {
            ResponseEntity<SendInvoiceResponse> resp = ksefRestTemplate.exchange(
                    url, HttpMethod.POST, bearerJson(accessToken, request), SendInvoiceResponse.class);
            if (resp.getBody() == null || resp.getBody().referenceNumber() == null) {
                throw new KsefSubmissionException("KSeF invoice send returned no referenceNumber from " + url);
            }
            return resp.getBody();
        } catch (HttpStatusCodeException e) {
            throw new KsefSubmissionException("KSeF invoice send failed [" + e.getStatusCode() + "]: "
                    + e.getResponseBodyAsString(), e);
        } catch (ResourceAccessException e) {
            throw new KsefSubmissionException("KSeF API unreachable at " + url + " — triggering offline mode", e);
        }
    }

    /** GET /sessions/{ref}/invoices/{invoiceRef} — per-invoice processing status. */
    public SessionInvoiceStatusResponse getInvoiceStatus(String accessToken, String sessionReference,
                                                         String invoiceReference) {
        String url = base() + "/sessions/" + sessionReference + "/invoices/" + invoiceReference;
        try {
            ResponseEntity<SessionInvoiceStatusResponse> resp = ksefRestTemplate.exchange(
                    url, HttpMethod.GET, bearer(accessToken), SessionInvoiceStatusResponse.class);
            if (resp.getBody() == null) {
                throw new KsefSubmissionException("KSeF returned an empty invoice status for ref " + invoiceReference);
            }
            return resp.getBody();
        } catch (HttpStatusCodeException e) {
            throw new KsefSubmissionException("KSeF invoice status check failed [" + e.getStatusCode() + "]: "
                    + e.getResponseBodyAsString(), e);
        } catch (ResourceAccessException e) {
            throw new KsefSubmissionException("KSeF API unreachable while polling status for ref " + invoiceReference, e);
        }
    }

    /**
     * GET /sessions/{ref}/invoices/{invoiceRef}/upo — downloads the official UPO XML.
     * Returns empty (never throws) when the UPO is not yet available (e.g. sandbox/404).
     */
    public Optional<String> fetchUpoXml(String accessToken, String sessionReference, String invoiceReference) {
        String url = base() + "/sessions/" + sessionReference + "/invoices/" + invoiceReference + "/upo";
        try {
            ResponseEntity<String> resp = ksefRestTemplate.exchange(
                    url, HttpMethod.GET, bearer(accessToken), String.class);
            String body = resp.getBody();
            if (body != null && !body.isBlank()) {
                return Optional.of(body);
            }
            return Optional.empty();
        } catch (HttpStatusCodeException e) {
            log.warn("[KSeF2] UPO fetch returned [{}] for invoice ref [{}] — UPO not yet available",
                    e.getStatusCode(), invoiceReference);
            return Optional.empty();
        } catch (ResourceAccessException e) {
            log.warn("[KSeF2] UPO endpoint unreachable for invoice ref [{}]", invoiceReference);
            return Optional.empty();
        }
    }

    /** POST /sessions/online/{ref}/close — closes the online session (Bearer accessToken). */
    public void closeOnlineSession(String accessToken, String sessionReference) {
        String url = base() + "/sessions/online/" + sessionReference + "/close";
        try {
            ksefRestTemplate.exchange(url, HttpMethod.POST, bearer(accessToken), Void.class);
            log.debug("[KSeF2] Online session [{}] closed", sessionReference);
        } catch (HttpStatusCodeException | ResourceAccessException e) {
            // Closing is best-effort; the session expires on its own (validUntil).
            log.warn("[KSeF2] Failed to close online session [{}]: {}", sessionReference, e.getMessage());
        }
    }

    // ── Helpers ────────────────────────────────────────────────────────────────────

    private static HttpEntity<Void> bearer(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return new HttpEntity<>(headers);
    }

    private static <T> HttpEntity<T> bearerJson(String token, T body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(body, headers);
    }
}
