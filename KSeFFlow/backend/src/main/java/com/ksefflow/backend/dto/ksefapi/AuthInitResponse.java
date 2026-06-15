package com.ksefflow.backend.dto.ksefapi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * KSeF 2.0 — 202 response of {@code POST /auth/xades-signature} (and {@code /auth/ksef-token}).
 *
 * Authentication is asynchronous: this returns a reference number plus a temporary
 * operation token. Both are used to poll {@code GET /auth/{referenceNumber}} and then to
 * redeem the real access/refresh tokens via {@code POST /auth/token/redeem}.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record AuthInitResponse(
        String referenceNumber,
        TokenInfo authenticationToken) {
}
