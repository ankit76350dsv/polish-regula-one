package com.safevoice.backend.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.kms.KmsClient;
import software.amazon.awssdk.services.kms.KmsClientBuilder;

import java.net.URI;

/**
 * Builds the one AWS KMS client the app uses.
 *
 * Plain-English idea:
 *   - AWS KMS holds a "master key" that lives inside AWS and NEVER comes out.
 *   - We ask KMS for a small, one-time "data key" to lock a report, and later we ask KMS
 *     to unlock that same data key. The actual locking/unlocking of the report text happens
 *     in the user's browser — the server only ever touches the tiny data keys.
 *   - The master key stays in the SAME EEA region as the rest of our data (data residency).
 *
 * Security notes:
 *   - We do NOT put any AWS password in the code. The AWS SDK finds the credentials the safe
 *     way (an IAM role on the server, or environment variables) — exactly like the S3 client.
 *   - The optional endpoint override is only for local testing against a fake KMS
 *     (e.g. LocalStack). In real environments we leave it blank so it talks to real AWS.
 */
@Slf4j
@Configuration
public class KmsConfig {

    // The AWS region where our KMS master key lives. Keep it inside the EEA (e.g. Frankfurt)
    // so key material and audit trails never leave the allowed region.
    @Value("${safevoice.aws.region:eu-central-1}")
    private String region;

    // Optional: point at a local, fake KMS for development (LocalStack). Blank = real AWS KMS.
    @Value("${safevoice.kms.endpoint:}")
    private String endpointOverride;

    @Bean
    public KmsClient kmsClient() {
        KmsClientBuilder builder = KmsClient.builder().region(Region.of(region));
        // Local dev only: send KMS calls to a fake local KMS instead of real AWS.
        if (endpointOverride != null && !endpointOverride.isBlank()) {
            builder = builder.endpointOverride(URI.create(endpointOverride));
            log.info("[KmsConfig]: KMS endpoint override set to '{}' (local/dev only).", endpointOverride);
        }
        log.info("[KmsConfig]: AWS KMS client ready in region '{}'.", region);
        return builder.build();
    }
}
