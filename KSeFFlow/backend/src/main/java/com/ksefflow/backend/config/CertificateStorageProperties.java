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

    // Local path (dev) or S3 key prefix (prod) where encrypted .pfx files are stored.
    @NotBlank(message = "ksef.cert.storage-path must be set")
    private String storagePath;

    // 32-byte hex string (64 hex chars) — the AES-256-GCM master encryption key.
    // Dev: set in .env as KSEF_CERT_ENCRYPTION_KEY.
    // Prod: injected from AWS Secrets Manager.
    @NotBlank(message = "ksef.cert.encryption-key must be set")
    @Size(min = 64, max = 64, message = "ksef.cert.encryption-key must be exactly 64 hex characters (32 bytes / 256 bits)")
    private String encryptionKey;

    // Maximum size in bytes for an uploaded certificate file — default 1 MB
    @Min(value = 1024, message = "ksef.cert.max-file-size must be at least 1024 bytes")
    private long maxFileSize = 1_048_576L;
}
