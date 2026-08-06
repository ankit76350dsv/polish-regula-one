package com.regulaone.backend.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;

/**
 * WHICH AWS ACCOUNT THIS APPLICATION ACTS AS, decided in one place for both AWS
 * services it uses: Cognito (sign-in) and SES (e-mail).
 *
 * ── WHY THIS CLASS HAD TO EXIST ─────────────────────────────────────────────────
 *
 * The AWS SDK does NOT read Spring configuration. Writing AWS_ACCESS_KEY_ID into
 * application-dev.properties therefore did nothing at all — the SDK carried on using
 * whatever was in ~/.aws/credentials, while the properties file said otherwise. That
 * gap is exactly the kind of thing that costs an afternoon. This bean closes it: keys
 * set in the properties file are now genuinely the keys used.
 *
 * ── HOW IT CHOOSES ──────────────────────────────────────────────────────────────
 *
 *   1. BOTH aws.access-key-id and aws.secret-access-key set → those keys are used.
 *   2. Otherwise → the SDK's normal chain: environment variables, JVM system
 *      properties, ~/.aws/credentials, then the IAM role of the container or
 *      instance.
 *
 * Rule 2 is what production should rely on. An IAM ROLE is better than any key pair:
 * the credentials rotate by themselves and there is no long-lived secret to leak.
 * Keys in a file are a convenience for local development, where the file is
 * git-ignored — they are not a pattern to carry into production.
 *
 * The same shape is already used by KSeFFlow's S3Config, so this is the platform's
 * established way of doing it rather than a new invention.
 */
@Slf4j
@Configuration
public class AwsCredentialsConfig {

    @Value("${aws.access-key-id:}")
    private String accessKeyId;

    @Value("${aws.secret-access-key:}")
    private String secretAccessKey;

    /**
     * The credentials every AWS client in this application uses.
     *
     * The log line names the access key id but NEVER the secret: the id identifies
     * which IAM user is in play (which is what you need when something is denied),
     * while the secret is the part that must not appear in a log file.
     */
    @Bean
    @SuppressWarnings("deprecation")   // DefaultCredentialsProvider.create(), as elsewhere in the codebase
    public AwsCredentialsProvider awsCredentialsProvider() {
        boolean hasStaticKeys = accessKeyId != null && !accessKeyId.isBlank()
                && secretAccessKey != null && !secretAccessKey.isBlank();

        if (hasStaticKeys) {
            log.info("[aws] Using the access key configured in properties (key id {})", accessKeyId);
            return StaticCredentialsProvider.create(
                    AwsBasicCredentials.create(accessKeyId.trim(), secretAccessKey.trim()));
        }

        log.info("[aws] No key configured in properties — using the SDK default chain "
                + "(environment, ~/.aws/credentials, or the instance IAM role)");
        return DefaultCredentialsProvider.create();
    }
}
