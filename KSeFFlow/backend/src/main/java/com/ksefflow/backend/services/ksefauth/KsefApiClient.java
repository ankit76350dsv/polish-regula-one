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
        log.info("[getAuthChallenge]:1 POST {} — requesting auth challenge", url);
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
     * ! POST /auth/xades-signature — submits the XAdES-signed AuthTokenRequest XML.
     * Returns the temporary {@code authenticationToken} + {@code referenceNumber} (202, async).
     */
    public AuthInitResponse submitXadesSignature(String signedXml) {
        String url = base() + "/auth/xades-signature";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_XML);
        log.info("[submitXadesSignature]:1 POST {} — submitting XAdES-signed AuthTokenRequest ({} bytes)",
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

    /**TODO: GET /auth/{referenceNumber} — status of the async auth operation (Bearer authenticationToken). */
    public AuthStatusResponse getAuthStatus(String referenceNumber, String authenticationToken) {
        String url = base() + "/auth/" + referenceNumber;
        log.info("[getAuthStatus]:1 GET {} — checking auth status for ref [{}]", url, referenceNumber);
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
        log.info("[redeemTokens]:1 POST {} — redeeming access + refresh tokens", url);
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
    //! Using the refreshToken it will return the accessToken
    public AuthTokenRefreshResponse refreshAccessToken(String refreshToken) {
        String url = base() + "/auth/token/refresh";
        log.info("[refreshAccessToken]:1 POST {} — refreshing accessToken", url);
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
        log.info("[getPublicKeyCertificates]:1 GET {} — fetching MF public keys", url);
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

    // ── Health probe ─────────────────────────────────────────────────────────────

    /**
     * Lightweight "is KSeF up?" check used by the availability monitor (C7).
     *
     * It does a cheap, UNAUTHENTICATED GET to the public-key endpoint (the same one the
     * submit pipeline already uses) and simply reports reachable / not reachable. It NEVER
     * throws — a failure here is a normal, expected signal, not an error to propagate.
     *
     * @return true if KSeF answered with a 2xx; false if it was unreachable or returned an error.
     */
    public boolean isApiReachable() {
        String url = base() + "/security/public-key-certificates";
        try {
            ResponseEntity<Void> resp = ksefRestTemplate.exchange(
                    url, HttpMethod.GET, HttpEntity.EMPTY, Void.class);
            return resp.getStatusCode().is2xxSuccessful();
        } catch (HttpStatusCodeException e) {
            // KSeF answered, but with an error code — treat 5xx as "down", other codes as "up
            // enough to talk to" (e.g. a 4xx still means the service itself is responding).
            boolean reachable = !e.getStatusCode().is5xxServerError();
            log.debug("[isApiReachable]:1 KSeF returned [{}] — reachable={}", e.getStatusCode(), reachable);
            return reachable;
        } catch (ResourceAccessException e) {
            log.debug("[isApiReachable]:2 KSeF not reachable at {}: {}", url, e.getMessage());
            return false;
        }
    }

    // ── Online session + invoice ───────────────────────────────────────────────────

    /** POST /sessions/online — opens an encrypted online session (Bearer accessToken). */
    public OpenOnlineSessionResponse openOnlineSession(String accessToken, OpenOnlineSessionRequest request) {
        String url = base() + "/sessions/online";
        log.info("[openOnlineSession]:1 POST {} — opening encrypted online session", url);
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
        log.info("[sendInvoice]:1 POST {} — sending encrypted invoice", url);
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
        log.info("[getInvoiceStatus]:1 GET {} — polling invoice status", url);
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
        log.info("[fetchUpoXml]:1 GET {} — fetching official UPO XML", url);
        try {
            ResponseEntity<String> resp = ksefRestTemplate.exchange(
                    url, HttpMethod.GET, bearer(accessToken), String.class);
            String body = resp.getBody();
            if (body != null && !body.isBlank()) {
                log.info("[fetchUpoXml]:2 UPO XML received for invoice ref [{}]", invoiceReference);
                return Optional.of(body);
            }
            log.warn("[fetchUpoXml]:3 Empty UPO body for invoice ref [{}]", invoiceReference);
            return Optional.empty();
        } catch (HttpStatusCodeException e) {
            log.warn("[fetchUpoXml]:4 UPO fetch returned [{}] for invoice ref [{}] — UPO not yet available",
                    e.getStatusCode(), invoiceReference);
            return Optional.empty();
        } catch (ResourceAccessException e) {
            log.warn("[fetchUpoXml]:5 UPO endpoint unreachable for invoice ref [{}]", invoiceReference);
            return Optional.empty();
        }
    }

    /** POST /sessions/online/{ref}/close — closes the online session (Bearer accessToken). */
    public void closeOnlineSession(String accessToken, String sessionReference) {
        String url = base() + "/sessions/online/" + sessionReference + "/close";
        log.info("[closeOnlineSession]:1 POST {} — closing online session", url);
        try {
            ksefRestTemplate.exchange(url, HttpMethod.POST, bearer(accessToken), Void.class);
            log.info("[closeOnlineSession]:2 Online session [{}] closed", sessionReference);
        } catch (HttpStatusCodeException | ResourceAccessException e) {
            // Closing is best-effort; the session expires on its own (validUntil).
            log.warn("[closeOnlineSession]:3 Failed to close online session [{}]: {}", sessionReference, e.getMessage());
        }
    }

    // ── Receiving invoices (faktury otrzymane) ───────────────────────────────────

    /**
     * POST /invoices/query/metadata — lists invoice metadata for the authenticated subject.
     * For RECEIVING (purchase) invoices the caller passes subjectType "Subject2" (= buyer).
     * Paging is via the query parameters pageOffset (0-based) and pageSize.
     */
    public QueryInvoicesMetadataResponse queryInvoiceMetadata(String accessToken,
                                                              QueryInvoicesMetadataRequest request,
                                                              int pageOffset, int pageSize) {
        String url = base() + "/invoices/query/metadata?pageOffset=" + pageOffset + "&pageSize=" + pageSize;
        log.info("[queryInvoiceMetadata]:1 POST {} — subjectType={}", url, request.subjectType());
        try {
            ResponseEntity<QueryInvoicesMetadataResponse> resp = ksefRestTemplate.exchange(
                    url, HttpMethod.POST, bearerJson(accessToken, request), QueryInvoicesMetadataResponse.class);
            QueryInvoicesMetadataResponse body = resp.getBody();
            if (body == null) {
                throw new KsefSubmissionException("KSeF returned an empty invoice metadata page from " + url);
            }
            return body;
        } catch (HttpStatusCodeException e) {
            throw new KsefSubmissionException("KSeF invoice metadata query failed [" + e.getStatusCode() + "]: "
                    + e.getResponseBodyAsString(), e);
        } catch (ResourceAccessException e) {
            throw new KsefSubmissionException("KSeF API unreachable at " + url, e);
        }
    }

    /**
     * GET /invoices/ksef/{ksefNumber} — downloads the full invoice XML by its KSeF number.
     * Returns the raw FA(3) XML the seller submitted. Used to fetch the body of a received invoice.
     */
    public String getInvoiceByKsefNumber(String accessToken, String ksefNumber) {
        String url = base() + "/invoices/ksef/" + ksefNumber;
        log.info("[getInvoiceByKsefNumber]:1 GET {} — fetching received invoice XML", url);
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        headers.setAccept(List.of(MediaType.APPLICATION_XML, MediaType.TEXT_XML));
        try {
            ResponseEntity<String> resp = ksefRestTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers), String.class);
            String body = resp.getBody();
            if (body == null || body.isBlank()) {
                throw new KsefSubmissionException("KSeF returned an empty invoice body for ksefNumber " + ksefNumber);
            }
            return body;
        } catch (HttpStatusCodeException e) {
            throw new KsefSubmissionException("KSeF invoice download failed [" + e.getStatusCode() + "]: "
                    + e.getResponseBodyAsString(), e);
        } catch (ResourceAccessException e) {
            throw new KsefSubmissionException("KSeF API unreachable at " + url, e);
        }
    }

    // ── KSeF certificate enrollment (C3) ─────────────────────────────────────────

    /** GET /certificates/enrollments/data — the subject fields KSeF wants inside the CSR. */
    public CertificateEnrollmentDataResponse getCertificateEnrollmentData(String accessToken) {
        String url = base() + "/certificates/enrollments/data";
        log.info("[getCertificateEnrollmentData]:1 GET {} — fetching enrollment subject data", url);
        try {
            ResponseEntity<CertificateEnrollmentDataResponse> resp = ksefRestTemplate.exchange(
                    url, HttpMethod.GET, bearer(accessToken), CertificateEnrollmentDataResponse.class);
            if (resp.getBody() == null || resp.getBody().commonName() == null) {
                throw new KsefSubmissionException("KSeF returned empty certificate enrollment data from " + url);
            }
            return resp.getBody();
        } catch (HttpStatusCodeException e) {
            throw new KsefSubmissionException("KSeF enrollment-data fetch failed [" + e.getStatusCode() + "]: "
                    + e.getResponseBodyAsString(), e);
        } catch (ResourceAccessException e) {
            throw new KsefSubmissionException("KSeF API unreachable at " + url, e);
        }
    }

    /** POST /certificates/enrollments — submits the CSR; returns the request referenceNumber (202). */
    public EnrollCertificateResponse enrollCertificate(String accessToken, EnrollCertificateRequest request) {
        String url = base() + "/certificates/enrollments";
        log.info("[enrollCertificate]:1 POST {} — enrolling certificate [{}] type [{}]",
                url, request.certificateName(), request.certificateType());
        try {
            ResponseEntity<EnrollCertificateResponse> resp = ksefRestTemplate.exchange(
                    url, HttpMethod.POST, bearerJson(accessToken, request), EnrollCertificateResponse.class);
            if (resp.getBody() == null || resp.getBody().referenceNumber() == null) {
                throw new KsefSubmissionException("KSeF certificate enrollment returned no referenceNumber from " + url);
            }
            return resp.getBody();
        } catch (HttpStatusCodeException e) {
            throw new KsefSubmissionException("KSeF certificate enrollment failed [" + e.getStatusCode() + "]: "
                    + e.getResponseBodyAsString(), e);
        } catch (ResourceAccessException e) {
            throw new KsefSubmissionException("KSeF API unreachable at " + url, e);
        }
    }

    /** GET /certificates/enrollments/{referenceNumber} — polls the enrollment status. */
    public CertificateEnrollmentStatusResponse getCertificateEnrollmentStatus(String accessToken, String referenceNumber) {
        String url = base() + "/certificates/enrollments/" + referenceNumber;
        log.info("[getCertificateEnrollmentStatus]:1 GET {} — polling enrollment status", url);
        try {
            ResponseEntity<CertificateEnrollmentStatusResponse> resp = ksefRestTemplate.exchange(
                    url, HttpMethod.GET, bearer(accessToken), CertificateEnrollmentStatusResponse.class);
            if (resp.getBody() == null || resp.getBody().status() == null) {
                throw new KsefSubmissionException("KSeF returned empty enrollment status for ref " + referenceNumber);
            }
            return resp.getBody();
        } catch (HttpStatusCodeException e) {
            throw new KsefSubmissionException("KSeF enrollment-status check failed [" + e.getStatusCode() + "]: "
                    + e.getResponseBodyAsString(), e);
        } catch (ResourceAccessException e) {
            throw new KsefSubmissionException("KSeF API unreachable at " + url, e);
        }
    }

    /** POST /certificates/retrieve — downloads the issued certificate(s) by serial number. */
    public RetrieveCertificatesResponse retrieveCertificates(String accessToken, RetrieveCertificatesRequest request) {
        String url = base() + "/certificates/retrieve";
        log.info("[retrieveCertificates]:1 POST {} — retrieving {} certificate(s)",
                url, request.certificateSerialNumbers() != null ? request.certificateSerialNumbers().size() : 0);
        try {
            ResponseEntity<RetrieveCertificatesResponse> resp = ksefRestTemplate.exchange(
                    url, HttpMethod.POST, bearerJson(accessToken, request), RetrieveCertificatesResponse.class);
            if (resp.getBody() == null || resp.getBody().certificates() == null) {
                throw new KsefSubmissionException("KSeF certificate retrieve returned nothing from " + url);
            }
            return resp.getBody();
        } catch (HttpStatusCodeException e) {
            throw new KsefSubmissionException("KSeF certificate retrieve failed [" + e.getStatusCode() + "]: "
                    + e.getResponseBodyAsString(), e);
        } catch (ResourceAccessException e) {
            throw new KsefSubmissionException("KSeF API unreachable at " + url, e);
        }
    }

    // ── Permissions / authorizations (uprawnienia, C2) ───────────────────────────

    /** POST /permissions/persons/grants — grants permissions to a person (async, 202). */
    public PermissionsOperationResponse grantPersonPermissions(String accessToken, PersonPermissionsGrantRequest request) {
        String url = base() + "/permissions/persons/grants";
        log.info("[grantPersonPermissions]:1 POST {} — granting {} permission(s)",
                url, request.permissions() != null ? request.permissions().size() : 0);
        try {
            ResponseEntity<PermissionsOperationResponse> resp = ksefRestTemplate.exchange(
                    url, HttpMethod.POST, bearerJson(accessToken, request), PermissionsOperationResponse.class);
            if (resp.getBody() == null || resp.getBody().referenceNumber() == null) {
                throw new KsefSubmissionException("KSeF permission grant returned no referenceNumber from " + url);
            }
            return resp.getBody();
        } catch (HttpStatusCodeException e) {
            throw new KsefSubmissionException("KSeF permission grant failed [" + e.getStatusCode() + "]: "
                    + e.getResponseBodyAsString(), e);
        } catch (ResourceAccessException e) {
            throw new KsefSubmissionException("KSeF API unreachable at " + url, e);
        }
    }

    /** POST /permissions/query/persons/grants — lists person permissions (paged). */
    public QueryPersonPermissionsResponse queryPersonPermissions(String accessToken,
                                                                 PersonPermissionsQueryRequest request,
                                                                 int pageOffset, int pageSize) {
        String url = base() + "/permissions/query/persons/grants?pageOffset=" + pageOffset + "&pageSize=" + pageSize;
        log.info("[queryPersonPermissions]:1 POST {} — queryType={}", url, request.queryType());
        try {
            ResponseEntity<QueryPersonPermissionsResponse> resp = ksefRestTemplate.exchange(
                    url, HttpMethod.POST, bearerJson(accessToken, request), QueryPersonPermissionsResponse.class);
            if (resp.getBody() == null) {
                throw new KsefSubmissionException("KSeF returned an empty permissions page from " + url);
            }
            return resp.getBody();
        } catch (HttpStatusCodeException e) {
            throw new KsefSubmissionException("KSeF permission query failed [" + e.getStatusCode() + "]: "
                    + e.getResponseBodyAsString(), e);
        } catch (ResourceAccessException e) {
            throw new KsefSubmissionException("KSeF API unreachable at " + url, e);
        }
    }

    /** DELETE /permissions/common/grants/{permissionId} — revokes one granted permission (async, 202). */
    public PermissionsOperationResponse revokePermission(String accessToken, String permissionId) {
        String url = base() + "/permissions/common/grants/" + permissionId;
        log.info("[revokePermission]:1 DELETE {} — revoking permission", url);
        try {
            ResponseEntity<PermissionsOperationResponse> resp = ksefRestTemplate.exchange(
                    url, HttpMethod.DELETE, bearer(accessToken), PermissionsOperationResponse.class);
            if (resp.getBody() == null || resp.getBody().referenceNumber() == null) {
                throw new KsefSubmissionException("KSeF permission revoke returned no referenceNumber from " + url);
            }
            return resp.getBody();
        } catch (HttpStatusCodeException e) {
            throw new KsefSubmissionException("KSeF permission revoke failed [" + e.getStatusCode() + "]: "
                    + e.getResponseBodyAsString(), e);
        } catch (ResourceAccessException e) {
            throw new KsefSubmissionException("KSeF API unreachable at " + url, e);
        }
    }

    /** GET /permissions/operations/{referenceNumber} — status of an async grant/revoke. */
    public PermissionsOperationStatusResponse getPermissionsOperationStatus(String accessToken, String referenceNumber) {
        String url = base() + "/permissions/operations/" + referenceNumber;
        log.info("[getPermissionsOperationStatus]:1 GET {} — polling permission operation", url);
        try {
            ResponseEntity<PermissionsOperationStatusResponse> resp = ksefRestTemplate.exchange(
                    url, HttpMethod.GET, bearer(accessToken), PermissionsOperationStatusResponse.class);
            if (resp.getBody() == null || resp.getBody().status() == null) {
                throw new KsefSubmissionException("KSeF returned empty permission operation status for ref " + referenceNumber);
            }
            return resp.getBody();
        } catch (HttpStatusCodeException e) {
            throw new KsefSubmissionException("KSeF permission operation status failed [" + e.getStatusCode() + "]: "
                    + e.getResponseBodyAsString(), e);
        } catch (ResourceAccessException e) {
            throw new KsefSubmissionException("KSeF API unreachable at " + url, e);
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
