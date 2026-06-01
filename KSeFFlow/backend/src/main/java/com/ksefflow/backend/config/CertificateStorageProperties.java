package com.ksefflow.backend.config;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

// Typed configuration for certificate storage and encryption.
// Values come from application-{profile}.properties and override-able via env vars.
//
// Validated at startup — if KSEF_CERT_ENCRYPTION_KEY is missing or too short,
// the application refuses to start rather than running with broken crypto.
@Component
@ConfigurationProperties(prefix = "ksef.cert")
@Validated
@Data
public class CertificateStorageProperties {

    // 32-byte hex string (64 hex chars) — the AES-256-GCM master encryption key.
    // Dev: set in .env as KSEF_CERT_ENCRYPTION_KEY.
    // Prod: injected from AWS Secrets Manager.
    @NotBlank(message = "ksef.cert.encryption-key must be set")
    @Size(min = 64, max = 64, message = "ksef.cert.encryption-key must be exactly 64 hex characters (32 bytes / 256 bits)")
    private String encryptionKey;

    // Maximum size in bytes for an uploaded certificate file — default 1 MB
    @Min(value = 1024, message = "ksef.cert.max-file-size must be at least 1024 bytes")
    private long maxFileSize = 1_048_576L;

    // S3 settings — encrypted certificates are always stored on S3.
    private final S3 s3 = new S3();

    @Data
    public static class S3 {
        // Target bucket for encrypted certificate objects. MUST reside in the EEA
        // (e.g. eu-central-1) to satisfy CLAUDE.md data-residency rules.
        private String bucket;

        // AWS region of the bucket, e.g. "eu-central-1".
        private String region;

        // Optional key prefix inside the bucket. Objects are stored at
        // {prefix}/{tenantId}/{fileName}.enc — tenant-scoped for isolation.
        private String keyPrefix = "ksef-certificates";

        // Static credentials. Leave BLANK in prod to use the default AWS credential
        // chain (IAM role / instance profile) — never hardcode keys in source.
        // For local dev these come from env vars (KSEF_S3_ACCESS_KEY / _SECRET_KEY).
        private String accessKey;
        private String secretKey;
    }
}
