package com.regulaone.backend.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.sesv2.SesV2Client;

/**
 * The AWS SES client used to send e-mail.
 *
 * Which AWS account it acts as is decided once, in {@link AwsCredentialsConfig} — the
 * same credentials Cognito uses.
 */
@Configuration
@RequiredArgsConstructor
public class AwsSesConfig {

    private final AwsCredentialsProvider awsCredentialsProvider;

    @Bean
    public SesV2Client sesV2Client() {
        return SesV2Client.builder()
                // NOTE: the SES region is fixed here, unlike Cognito's which is
                // configurable. Moving SES to another region is a code change.
                .region(Region.EU_CENTRAL_1)
                .credentialsProvider(awsCredentialsProvider)
                .build();
    }
}