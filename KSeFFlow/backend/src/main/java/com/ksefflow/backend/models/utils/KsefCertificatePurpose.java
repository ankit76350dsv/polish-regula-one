package com.ksefflow.backend.models.utils;

/**
 * The role of a KSeF certificate, as defined by the Ministry of Finance KSeF spec
 * (CIRFMF/ksef-docs/certyfikaty-KSeF.md). A KSeF certificate carries EXACTLY ONE
 * purpose — combined certificates are prohibited by the specification.
 *
 * AUTHENTICATION — "Uwierzytelnienie": used to log in to / authenticate with KSeF.
 *                  KeyUsage = Digital Signature. Enrolled via POST /certificates/enrollments.
 *
 * OFFLINE        — "Certyfikat przeznaczony wyłącznie do wystawiania faktur w trybie offline":
 *                  the ONLY certificate type permitted to seal the offline QR Code II
 *                  ("CERTYFIKAT"). KeyUsage = Non-Repudiation. Must NOT be used for login,
 *                  and the authentication certificate must NOT be used for offline sealing.
 *
 * NOTE: this is distinct from {@link KsefCertificateType} (PFX/PEM/TRUSTED_PROFILE), which
 * describes the certificate's file FORMAT/source, not its KSeF role.
 */
public enum KsefCertificatePurpose {
    AUTHENTICATION,
    OFFLINE
}
