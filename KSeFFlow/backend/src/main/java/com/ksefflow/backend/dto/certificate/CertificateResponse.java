package com.ksefflow.backend.dto.certificate;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.ksefflow.backend.models.KsefCertificate;
import com.ksefflow.backend.models.utils.KsefCertificateType;
import com.ksefflow.backend.models.utils.KsefCertificateVerificationStatus;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Safe public representation of a KsefCertificate document.
 *
 * Security contract — this DTO MUST NEVER include:
 *   - encryptedStoragePath  (internal filesystem/S3 path)
 *   - vaultPasswordReference (encrypted password blob)
 *   - any raw certificate bytes or private key material
 *
 * Only metadata fields visible to the admin are exposed.
 */
@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CertificateResponse {

    private String id;
    private String tenantId;
    private String fileName;
    private KsefCertificateType type;

    // X.509 identity metadata
    private String issuedTo;
    private String issuer;
    private LocalDate validFrom;
    private LocalDate validTo;

    // Status
    private boolean active;
    private KsefCertificateVerificationStatus verificationStatus;

    // Usage stats
    private int    authSuccessCount;
    private int    authFailureCount;
    private LocalDateTime lastAuthTime;

    // Ownership
    private String uploadedByUserId;

    // Timestamps
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime lastVerifiedAt;

    // ── Factory ───────────────────────────────────────────────────────────────

    public static CertificateResponse from(KsefCertificate cert) {
        return CertificateResponse.builder()
                .id(cert.getId())
                .tenantId(cert.getTenantId())
                .fileName(cert.getFileName())
                .type(cert.getType())
                .issuedTo(cert.getIssuedTo())
                .issuer(cert.getIssuer())
                .validFrom(cert.getValidFrom())
                .validTo(cert.getValidTo())
                .active(cert.isActive())
                .verificationStatus(cert.getVerificationStatus())
                .authSuccessCount(cert.getAuthSuccessCount())
                .authFailureCount(cert.getAuthFailureCount())
                .lastAuthTime(cert.getLastAuthTime())
                .uploadedByUserId(cert.getUploadedByUserId())
                .createdAt(cert.getCreatedAt())
                .updatedAt(cert.getUpdatedAt())
                .lastVerifiedAt(cert.getLastVerifiedAt())
                .build();
    }
}
