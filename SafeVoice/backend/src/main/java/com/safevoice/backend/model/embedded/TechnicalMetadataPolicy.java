package com.safevoice.backend.model.embedded;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Embedded document recording privacy parameters for IP/user agent storage.
 * Enforces zero-telemetry rules under EU whistleblower laws.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TechnicalMetadataPolicy {

    private boolean reporterIpStored = false;
    private boolean userAgentStored = false;
    private boolean deviceFingerprintStored = false;
    private boolean geolocationStored = false;
    private boolean browserFingerprintStored = false;
}
