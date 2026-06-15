package com.ksefflow.backend.dto.ksefapi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

// Response from GET /certificates/enrollments/{referenceNumber}.
// status.code() tells us how the request is going:
//   100 = accepted/processing, 200 = done (certificate generated), 400/500/550 = failed.
// When done, certificateSerialNumber holds the serial we use to download the certificate.
@JsonIgnoreProperties(ignoreUnknown = true)
public record CertificateEnrollmentStatusResponse(
        String requestDate,
        StatusInfo status,
        String certificateSerialNumber) {}
