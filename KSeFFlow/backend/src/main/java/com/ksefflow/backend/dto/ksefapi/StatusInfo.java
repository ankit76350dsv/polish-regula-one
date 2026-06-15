package com.ksefflow.backend.dto.ksefapi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

/**
 * KSeF 2.0 — common {@code StatusInfo} block (code + human description + optional details).
 * Used by the auth-operation status and by per-invoice session status. A successful
 * terminal state is signalled by a specific {@code code} (see KSeFAuthService).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record StatusInfo(
        Integer code,
        String description,
        List<String> details) {
}
