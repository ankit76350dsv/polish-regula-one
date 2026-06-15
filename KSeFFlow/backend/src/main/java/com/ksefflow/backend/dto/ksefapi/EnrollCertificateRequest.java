package com.ksefflow.backend.dto.ksefapi;

// Request body for POST /certificates/enrollments — asks KSeF to issue a certificate.
//
// @param certificateName a friendly name we choose for the certificate
// @param certificateType "Authentication" (log in to KSeF) or "Offline" (seal offline invoices)
// @param csr             the PKCS#10 certificate signing request, DER bytes Base64-encoded
// @param validFrom       optional ISO date when the certificate should start being valid (may be null)
public record EnrollCertificateRequest(
        String certificateName,
        String certificateType,
        String csr,
        String validFrom) {}
