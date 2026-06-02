package com.ksefflow.backend.services.ksefauth;

import com.ksefflow.backend.config.KsefApiProperties;
import com.ksefflow.backend.dto.ksefapi.*;
import com.ksefflow.backend.exceptions.KsefAuthException;
import com.ksefflow.backend.exceptions.KsefSubmissionException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

// Handles all HTTP communication with the KSeF government REST API.
// Each method maps to exactly one API endpoint.
// Throws KsefAuthException on any non-2xx response or network failure
// so the caller does not need to handle HTTP-specific exceptions.
@Component
@RequiredArgsConstructor
@Slf4j
public class KsefApiClient {

    private static final String CHALLENGE_PATH = "/online/Session/AuthorisationChallenge";
    private static final String AUTH_PATH = "/online/Session/Authorisation";
    private static final String TERMINATE_PATH = "/online/Session/Terminate";
    private static final String SESSION_HEADER = "SessionToken";

    private final KsefApiProperties apiProperties;
    private final RestTemplate ksefRestTemplate;

    // Step 1 of the auth flow.
    // POST /online/Session/AuthorisationChallenge → returns the challenge string
    // the company must sign to prove identity.
    public String requestChallenge(String nip) {

        String url = apiProperties.getActiveBaseUrl() + CHALLENGE_PATH;
        log.info("[RequestChallenge] Initiating KSeF challenge request for NIP [{}] to URL [{}]", nip, url);

        try {

            ResponseEntity<KsefChallengeResponse> response = ksefRestTemplate.postForEntity(
                    url,
                    KsefChallengeRequest.forNip(nip),
                    KsefChallengeResponse.class);
                    
            log.debug("[RequestChallenge] Challenge response received successfully from KSeF");

            if (response.getBody() == null || response.getBody().getChallenge() == null) {
                log.error("[RequestChallenge] Empty challenge response received from KSeF URL [{}]",url);
                throw new KsefAuthException("KSeF returned an empty challenge response from " + url);
            }

            log.info("[RequestChallenge] Challenge generated successfully for NIP [{}]",nip);
            return response.getBody().getChallenge();

        } catch (HttpStatusCodeException e) {

            log.error("[RequestChallenge] KSeF challenge request failed for NIP [{}] — status [{}], response [{}]", nip,e.getStatusCode(), e.getResponseBodyAsString(), e);

            throw new KsefAuthException("KSeF challenge request failed [" + e.getStatusCode() + "]: " + e.getResponseBodyAsString(), e);

        } catch (ResourceAccessException e) {
            log.error("[RequestChallenge] Unable to connect to KSeF API at URL [{}]", url, e);
            throw new KsefAuthException("KSeF API is unreachable at " + url + " — check network or consider offline mode", e);
        }
    }

    // Step 3 of the auth flow.
    // POST /online/Session/Authorisation → returns the session token.
    // challenge is included for traceability but not re-sent to the API —
    // only the signature (which proves the challenge was signed) is sent.
    public String authorise(String nip, String signedChallengeBase64, String certBase64) {
        String url = apiProperties.getActiveBaseUrl() + AUTH_PATH;

        KsefAuthRequest body = KsefAuthRequest.builder()
                .contextIdentifier(KsefContextIdentifier.ofNip(nip))
                .documentType(KsefDocumentType.fa2())
                .authenticationIdentifier(nip)
                .signature(KsefSignatureDto.of(signedChallengeBase64))
                .certificateBase64(certBase64)
                .build();

        try {
            ResponseEntity<KsefAuthResponse> response = ksefRestTemplate.postForEntity(url, body,
                    KsefAuthResponse.class);

            if (response.getBody() == null
                    || response.getBody().getSessionToken() == null
                    || response.getBody().getSessionToken().getToken() == null) {
                throw new KsefAuthException("KSeF authorisation response did not contain a session token");
            }
            return response.getBody().getSessionToken().getToken();

        } catch (HttpStatusCodeException e) {
            throw new KsefAuthException(
                    "KSeF authorisation failed [" + e.getStatusCode() + "]: " + e.getResponseBodyAsString(), e);
        } catch (ResourceAccessException e) {
            throw new KsefAuthException(
                    "KSeF API is unreachable at " + url + " — check network or consider offline mode", e);
        }
    }

    // POST /online/Invoice/Send — submits the FA(3) XML to KSeF for processing.
    // Returns the elementReferenceNumber used to poll for the final KSeF ID.
    // The XML must be UTF-8 encoded bytes; Content-Type must be
    // application/octet-stream.
    public KsefSendInvoiceResponse sendInvoice(String sessionToken, String xmlContent) {
        String url = apiProperties.getActiveBaseUrl() + "/online/Invoice/Send";
        HttpHeaders headers = new HttpHeaders();
        headers.set(SESSION_HEADER, sessionToken);
        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);

        byte[] xmlBytes = xmlContent.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        HttpEntity<byte[]> entity = new HttpEntity<>(xmlBytes, headers);

        log.debug("Sending invoice XML ({} bytes) to {}", xmlBytes.length, url);

        try {
            // ! here making the sending certificate api call
            ResponseEntity<KsefSendInvoiceResponse> response = ksefRestTemplate.postForEntity(url, entity,
                    KsefSendInvoiceResponse.class);

            if (response.getBody() == null || response.getBody().getElementReferenceNumber() == null) {
                throw new KsefSubmissionException(
                        "KSeF returned an empty invoice submission response from " + url);
            }

            log.info("Invoice submitted to KSeF — elementReferenceNumber: [{}]",
                    response.getBody().getElementReferenceNumber());

            return response.getBody();

        } catch (HttpStatusCodeException e) {
            throw new KsefSubmissionException(
                    "KSeF invoice submission failed [" + e.getStatusCode() + "]: " +
                            e.getResponseBodyAsString(),
                    e);
        } catch (ResourceAccessException e) {
            throw new KsefSubmissionException(
                    "KSeF API is unreachable at " + url + " — triggering offline mode", e);
        }
    }

    // GET /online/Invoice/Status/{elementReferenceNumber} — polls for the final
    // KSeF ID.
    // Call after sendInvoice() until ksefReferenceNumber is non-null.
    public KsefInvoiceStatusResponse getInvoiceStatus(String sessionToken, String elementReferenceNumber) {
        String url = apiProperties.getActiveBaseUrl() +
                "/online/Invoice/Status/" + elementReferenceNumber;

        HttpHeaders headers = new HttpHeaders();
        headers.set(SESSION_HEADER, sessionToken);

        try {
            ResponseEntity<KsefInvoiceStatusResponse> response = ksefRestTemplate.exchange(url, HttpMethod.GET,
                    new HttpEntity<>(headers), KsefInvoiceStatusResponse.class);

            if (response.getBody() == null) {
                throw new KsefSubmissionException(
                        "KSeF returned an empty status response for ref: " + elementReferenceNumber);
            }
            return response.getBody();

        } catch (HttpStatusCodeException e) {
            throw new KsefSubmissionException(
                    "KSeF invoice status check failed [" + e.getStatusCode() + "]: " +
                            e.getResponseBodyAsString(),
                    e);
        } catch (ResourceAccessException e) {
            throw new KsefSubmissionException(
                    "KSeF API is unreachable while polling status for ref: " + elementReferenceNumber, e);
        }
    }

    // GET /online/Invoice/UPO/{ksefReferenceNumber} — downloads the official UPO
    // receipt XML.
    // Returns empty if KSeF does not provide a UPO body (normal sandbox behaviour).
    // Never throws — a missing UPO triggers the stub fallback in
    // KSeFInvoiceService.
    public java.util.Optional<String> fetchUpoXml(String sessionToken, String ksefReferenceNumber) {
        String url = apiProperties.getActiveBaseUrl() + "/online/Invoice/UPO/" + ksefReferenceNumber;
        HttpHeaders headers = new HttpHeaders();
        headers.set(SESSION_HEADER, sessionToken);

        try {
            ResponseEntity<String> response = ksefRestTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers), String.class);
            String body = response.getBody();
            if (body != null && !body.isBlank()) {
                log.info("Real UPO XML received from KSeF for ksefRef [{}]", ksefReferenceNumber);
                return java.util.Optional.of(body);
            }
            return java.util.Optional.empty();
        } catch (HttpStatusCodeException e) {
            // 404 is normal in sandbox — KSeF does not issue signed UPO for test
            // submissions
            log.warn("KSeF UPO fetch returned [{}] for ref [{}] — falling back to stub UPO",
                    e.getStatusCode(), ksefReferenceNumber);
            return java.util.Optional.empty();
        } catch (ResourceAccessException e) {
            log.warn("KSeF UPO endpoint unreachable for ref [{}] — falling back to stub UPO",
                    ksefReferenceNumber);
            return java.util.Optional.empty();
        }
    }

    // DELETE /online/Session/Terminate — closes the government session.
    // The session token is sent in the SessionToken header (not as a bearer token).
    public void terminateSession(String sessionToken) {
        String url = apiProperties.getActiveBaseUrl() + TERMINATE_PATH;
        HttpHeaders headers = new HttpHeaders();
        headers.set(SESSION_HEADER, sessionToken);

        try {
            ksefRestTemplate.exchange(url, HttpMethod.DELETE, new HttpEntity<>(headers), Void.class);
            log.debug("Session terminated at {}", url);
        } catch (HttpStatusCodeException e) {
            throw new KsefAuthException(
                    "KSeF session termination failed [" + e.getStatusCode() + "]", e);
        }
    }
}
