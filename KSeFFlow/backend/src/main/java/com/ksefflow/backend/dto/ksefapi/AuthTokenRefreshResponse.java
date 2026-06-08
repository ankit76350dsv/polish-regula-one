package com.ksefflow.backend.dto.ksefapi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * KSeF 2.0 — response of {@code POST /auth/token/refresh} (refreshToken sent as a
 * Bearer credential). Returns a new accessToken carrying the current permission set.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record AuthTokenRefreshResponse(
        TokenInfo accessToken) {
}
