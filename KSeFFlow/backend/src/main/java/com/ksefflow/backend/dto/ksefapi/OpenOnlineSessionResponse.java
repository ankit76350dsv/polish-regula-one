package com.ksefflow.backend.dto.ksefapi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * KSeF 2.0 — 201 response of {@code POST /sessions/online}. The {@code referenceNumber}
 * identifies the open session and is used in the per-invoice send/status/UPO endpoints.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record OpenOnlineSessionResponse(
        String referenceNumber,
        String validUntil) {
}
