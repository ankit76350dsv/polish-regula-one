package com.ksefflow.backend.dto.ksefapi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

// Response (202 Accepted) from POST /certificates/enrollments.
// The request is processed asynchronously; we get a referenceNumber we can poll for status.
@JsonIgnoreProperties(ignoreUnknown = true)
public record EnrollCertificateResponse(
        String referenceNumber,
        String timestamp) {}
