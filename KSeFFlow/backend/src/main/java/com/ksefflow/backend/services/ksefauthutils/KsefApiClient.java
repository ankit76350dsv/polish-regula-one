package com.ksefflow.backend.services.ksefauthutils;

import com.ksefflow.backend.config.KsefApiProperties;
import com.ksefflow.backend.dto.ksefapi.*;
import com.ksefflow.backend.exceptions.KsefAuthException;
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
    private static final String AUTH_PATH      = "/online/Session/Authorisation";
    private static final String TERMINATE_PATH = "/online/Session/Terminate";
    private static final String SESSION_HEADER = "SessionToken";

    private final KsefApiProperties apiProperties;
    private final RestTemplate ksefRestTemplate;

    // Step 1 of the auth flow.
    // POST /online/Session/AuthorisationChallenge → returns the challenge string
    // the company must sign to prove identity.
    public String requestChallenge(String nip) {
        String url = apiProperties.getActiveBaseUrl() + CHALLENGE_PATH;
        log.debug("Requesting challenge from {}", url);

        try {
            ResponseEntity<KsefChallengeResponse> response =
                    ksefRestTemplate.postForEntity(url, KsefChallengeRequest.forNip(nip), KsefChallengeResponse.class);

            if (response.getBody() == null || response.getBody().getChallenge() == null) {
                throw new KsefAuthException("KSeF returned an empty challenge response from " + url);
            }
            return response.getBody().getChallenge();

        } catch (HttpStatusCodeException e) {
            throw new KsefAuthException(
                    "KSeF challenge request failed [" + e.getStatusCode() + "]: " + e.getResponseBodyAsString(), e);
        } catch (ResourceAccessException e) {
            throw new KsefAuthException(
                    "KSeF API is unreachable at " + url + " — check network or consider offline mode", e);
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
            ResponseEntity<KsefAuthResponse> response =
                    ksefRestTemplate.postForEntity(url, body, KsefAuthResponse.class);

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
