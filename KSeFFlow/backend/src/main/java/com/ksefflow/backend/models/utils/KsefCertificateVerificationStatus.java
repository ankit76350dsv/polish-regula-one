package com.ksefflow.backend.models.utils;

// Verification state of a digital certificate stored in the HSM vault.
//
// Daily background job checks validTo dates and OCSP/CRL revocation lists.
// An EXPIRED or REVOKED certificate blocks further invoice submissions until replaced.
public enum KsefCertificateVerificationStatus {

    // Certificate is within its validity window and passes OCSP/CRL check
    VERIFIED,

    // Certificate is past its validTo date — invoices cannot be signed until renewed
    EXPIRED,

    // Certificate has been explicitly revoked by the issuing CA
    REVOKED,

    // Uploaded but not yet verified against the issuing CA — verification in progress
    PENDING
}
