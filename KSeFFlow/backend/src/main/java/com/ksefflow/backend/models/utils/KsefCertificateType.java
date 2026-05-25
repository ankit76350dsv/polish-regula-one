package com.ksefflow.backend.models.utils;

// Type of digital certificate used to authenticate with the KSeF government API.
//
// PFX             — PKCS#12 bundle (certificate + private key). Most common for
//                   qualified electronic signatures issued by Polish CAs (KIR, Certum, etc.)
// PEM             — PEM-encoded certificate (often used for server-side TLS).
// TRUSTED_PROFILE — Profil Zaufany — Polish government eID; used by natural persons
//                   representing companies for KSeF API authentication.
public enum KsefCertificateType {
    PFX,
    PEM,
    TRUSTED_PROFILE
}
