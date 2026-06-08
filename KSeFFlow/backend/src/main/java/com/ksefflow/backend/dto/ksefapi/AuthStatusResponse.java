package com.ksefflow.backend.dto.ksefapi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * KSeF 2.0 — response of {@code GET /auth/{referenceNumber}}.
 *
 * Reports the state of the asynchronous authentication operation. On pre-prod/prod the
 * status stays "in progress" until the certificate's OCSP/CRL check completes at the
 * issuer, so callers must poll until the terminal success/failure code arrives.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record AuthStatusResponse(
        String startDate,
        String authenticationMethod,
        String authenticationMethodInfo,
        StatusInfo status,
        Boolean isTokenRedeemed,
        String lastTokenRefreshDate,
        String refreshTokenValidUntil) {
}
