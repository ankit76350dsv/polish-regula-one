package com.ksefflow.backend.dto.ksefapi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * KSeF 2.0 — response of {@code POST /auth/challenge}.
 *
 * The challenge has a 10-minute lifetime and is embedded (verbatim) into the
 * {@code AuthTokenRequest} XML that is then XAdES-signed. {@code timestampMs} is the
 * Unix epoch in milliseconds and is used as the nonce when authenticating with a
 * KSeF token (RSA-OAEP of {@code token|timestampMs}); for XAdES auth it is informational.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record AuthChallengeResponse(
        String challenge,
        String timestamp,
        Long timestampMs,
        String clientIp) {
}
