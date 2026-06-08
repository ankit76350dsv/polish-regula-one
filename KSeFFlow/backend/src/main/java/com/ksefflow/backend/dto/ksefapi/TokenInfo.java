package com.ksefflow.backend.dto.ksefapi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * KSeF 2.0 — a JWT plus its expiry, as returned inside the auth responses
 * (authenticationToken, accessToken, refreshToken).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record TokenInfo(
        String token,
        String validUntil) {
}
