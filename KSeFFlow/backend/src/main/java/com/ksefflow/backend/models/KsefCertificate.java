package com.ksefflow.backend.models;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import com.ksefflow.backend.models.utils.KsefCertificateType;
import com.ksefflow.backend.models.utils.KsefCertificateVerificationStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;

// Digital signing certificate used to authenticate with the KSeF government API.
//
// Security rules (from CLAUDE.md):
//   - NEVER store the certificate file content or private key in this document.
//   - The actual .pfx/.pem file is encrypted with AES-256-GCM and stored in S3.
//   - The private key password is stored in AWS KMS / HashiCorp Vault — never here.
//   - This document stores only metadata and vault/storage references.
//
// A background job (daily cron) re-validates verificationStatus against the
// issuing CA's OCSP endpoint and updates the status if the cert has expired or
// been revoked. An EXPIRED or REVOKED certificate blocks invoice submissions.
//
// Multi-tenancy: all queries MUST filter by tenantId.
@Document(collection = "ksef_certificates")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KsefCertificate {

    @Id
    private String id;

    // ── Multi-tenancy ──────────────────────────────────────────────────────────

    @Indexed
    private String tenantId;

    // ── Certificate identity ───────────────────────────────────────────────────

    // Original filename uploaded by the admin (e.g. "ksefflow_warszawa_2027.pfx")
    private String fileName;

    private KsefCertificateType type;

    // Subject (CN) from the certificate — who the cert was issued to
    private String issuedTo;

    // Name of the issuing Certificate Authority (e.g. "Krajowa Izba Rozliczeniowa S.A.")
    private String issuer;

    private LocalDate validFrom;
    private LocalDate validTo;

    @Builder.Default
    private KsefCertificateVerificationStatus verificationStatus = KsefCertificateVerificationStatus.PENDING;

    // ── Vault and storage references ───────────────────────────────────────────
    // These are opaque references — the actual keys/files live in external systems.

    // AWS KMS key ARN or HashiCorp Vault path where the certificate password is stored.
    // Used by the KSeF auth service to retrieve the password at runtime for signing.
    private String vaultPasswordReference;

    // Encrypted S3 object key for the certificate file (e.g. "certs/{tenantId}/{id}.pfx.enc")
    private String encryptedStoragePath;

    // ── Authentication tracking ────────────────────────────────────────────────

    // Timestamp of the last successful KSeF session opened with this certificate
    private LocalDateTime lastAuthTime;

    // Cumulative success/failure counters — used to detect patterns of auth issues
    @Builder.Default
    private int authSuccessCount = 0;

    @Builder.Default
    private int authFailureCount = 0;

    // ── Ownership ─────────────────────────────────────────────────────────────

    // User._id of the admin who uploaded this certificate
    private String uploadedByUserId;

    // Whether this certificate is the active signing cert for the tenant.
    // Only one certificate should be active=true per tenant at any time.
    @Builder.Default
    private boolean active = true;

    // ── Audit timestamps ───────────────────────────────────────────────────────

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime updatedAt;

    // When the last OCSP/CRL check was performed by the background validation job
    private LocalDateTime lastVerifiedAt;
}
