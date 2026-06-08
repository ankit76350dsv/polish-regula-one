package com.ksefflow.backend.dto.ksefapi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * KSeF 2.0 — response of {@code POST /auth/token/redeem}.
 *
 * Returned exactly once per successful authentication operation; a second redeem with
 * the same authenticationToken yields 400. The accessToken authorises API calls; the
 * refreshToken mints fresh accessTokens without re-authenticating.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record AuthTokensResponse(
        TokenInfo accessToken,
        TokenInfo refreshToken) {
}
