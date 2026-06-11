package com.ksefflow.backend.dto.ksefapi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

// Response from POST /certificates/retrieve — the issued certificate(s).
@JsonIgnoreProperties(ignoreUnknown = true)
public record RetrieveCertificatesResponse(List<RetrievedCertificate> certificates) {

    // One issued certificate. "certificate" is the public certificate in DER format, Base64-encoded
    // (it does NOT contain the private key — we keep the private key we generated locally).
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record RetrievedCertificate(
            String certificate,
            String certificateName,
            String certificateSerialNumber,
            String certificateType) {}
}
