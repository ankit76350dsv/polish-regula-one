package com.ksefflow.backend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;

/**
 * Creates the S3 client used to store AES-256-GCM-encrypted certificate files.
 *
 * Certificates are stored on S3 in ALL environments (local dev and production) —
 * there is no filesystem fallback.
 *
 * Credential resolution:
 *   - If ksef.cert.s3.access-key / secret-key are set → static credentials
 *     (used for local dev via KSEF_S3_ACCESS_KEY / KSEF_S3_SECRET_KEY env vars).
 *   - Otherwise → the AWS default credential chain (IAM role / instance profile),
 *     which is the recommended, key-less approach for production.
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class S3Config {

    private final CertificateStorageProperties props;

    @Bean
    public S3Client s3Client() {
        CertificateStorageProperties.S3 s3 = props.getS3();

        if (s3.getRegion() == null || s3.getRegion().isBlank()) {
            throw new IllegalStateException(
                    "ksef.cert.s3.region must be set when ksef.cert.storage-type=s3");
        }
        if (s3.getBucket() == null || s3.getBucket().isBlank()) {
            throw new IllegalStateException(
                    "ksef.cert.s3.bucket must be set when ksef.cert.storage-type=s3");
        }

        S3ClientBuilder builder = S3Client.builder()
                .region(Region.of(s3.getRegion()));

        boolean hasStaticKeys = s3.getAccessKey() != null && !s3.getAccessKey().isBlank()
                && s3.getSecretKey() != null && !s3.getSecretKey().isBlank();

        if (hasStaticKeys) {
            log.info("[s3Client]:1 Using static credentials for S3 bucket '{}' in region '{}'",
                    s3.getBucket(), s3.getRegion());
            builder.credentialsProvider(StaticCredentialsProvider.create(
                    AwsBasicCredentials.create(s3.getAccessKey(), s3.getSecretKey())));
        } else {
            log.info("[s3Client]:2 Using default AWS credential chain for S3 bucket '{}' in region '{}'",
                    s3.getBucket(), s3.getRegion());
            builder.credentialsProvider(DefaultCredentialsProvider.create());
        }

        return builder.build();
    }
}
