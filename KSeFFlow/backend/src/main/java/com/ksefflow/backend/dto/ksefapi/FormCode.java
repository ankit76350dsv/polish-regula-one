package com.ksefflow.backend.dto.ksefapi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * KSeF 2.0 — the invoice schema descriptor for an online session.
 *
 * For FA(3) the values are: systemCode="FA (3)", schemaVersion="1-0E", value="FA".
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record FormCode(
        String systemCode,
        String schemaVersion,
        String value) {
}
