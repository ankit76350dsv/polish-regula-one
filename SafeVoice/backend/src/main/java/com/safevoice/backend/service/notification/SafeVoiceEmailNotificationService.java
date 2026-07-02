package com.safevoice.backend.service.notification;

import com.safevoice.backend.model.document.RegulaOneUser;
import com.safevoice.backend.repository.RegulaOneUserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
import java.util.List;
import java.util.Objects;

@Slf4j
@Service
public class SafeVoiceEmailNotificationService {

    private static final List<String> NEW_REPORT_RECIPIENT_PERMISSIONS = List.of(
            "SAFEVOICE_ADMIN",
            "SAFEVOICE_COMPLIANCE_OFFICER",
            "SAFEVOICE_INVESTIGATOR",
            "SAFEVOICE_HR_MANAGER"
    );

    private static final String SUBJECT = "A SafeVoice case requires your attention";
    private static final String TEXT_BODY = """
            A new SafeVoice case requires attention.

            Sign in to RegulaOne SafeVoice to review it.
            """;
    private static final String HTML_BODY = """
            <p>A new SafeVoice case requires attention.</p>
            <p>Sign in to RegulaOne SafeVoice to review it.</p>
            """;

    private final RegulaOneUserRepository userRepository;
    private final RestClient emailClient;
    private final String serviceToken;
    private final boolean notificationsEnabled;

    public SafeVoiceEmailNotificationService(
            RegulaOneUserRepository userRepository,
            @Value("${regulaone.api.base-url}") String baseUrl,
            @Value("${regulaone.api.connect-timeout-ms:3000}") int connectTimeoutMs,
            @Value("${regulaone.api.read-timeout-ms:5000}") int readTimeoutMs,
            @Value("${regulaone.email.service-token:}") String serviceToken,
            @Value("${safevoice.email-notifications.enabled:true}") boolean notificationsEnabled) {
        this.userRepository = userRepository;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(connectTimeoutMs));
        factory.setReadTimeout(Duration.ofMillis(readTimeoutMs));
        this.emailClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(factory)
                .build();
        this.serviceToken = serviceToken;
        this.notificationsEnabled = notificationsEnabled;
    }

    public void notifyNewReport(String tenantId) {
        if (!notificationsEnabled) {
            return;
        }
        if (tenantId == null || tenantId.isBlank()) {
            log.warn("[SafeVoiceEmail] skipped new report email: missing tenant id");
            return;
        }
        if (serviceToken == null || serviceToken.isBlank()) {
            log.error("[SafeVoiceEmail] regulaone.email.service-token is not configured; email notification skipped");
            return;
        }

        List<String> recipients = userRepository
                .findByTenant_IdAndEnabledTrueAndPermissionsIn(tenantId, NEW_REPORT_RECIPIENT_PERMISSIONS)
                .stream()
                .filter(RegulaOneUser::emailNotificationsEnabled)
                .map(RegulaOneUser::getEmail)
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(email -> !email.isBlank())
                .distinct()
                .toList();

        if (recipients.isEmpty()) {
            log.info("[SafeVoiceEmail] no eligible recipients for new report notification; tenantId={}", tenantId);
            return;
        }

        int sentCount = 0;
        for (String recipient : recipients) {
            if (sendToRecipient(recipient)) {
                sentCount++;
            }
        }
        log.info("[SafeVoiceEmail] sent new report email notification for {}/{} eligible recipients; tenantId={}",
                sentCount, recipients.size(), tenantId);
    }

    private boolean sendToRecipient(String recipient) {
        SendEmailRequest request = new SendEmailRequest(
                List.of(recipient),
                List.of(),
                List.of(),
                SUBJECT,
                TEXT_BODY,
                HTML_BODY
        );
        try {
            emailClient.post()
                    .uri("/api/email/send")
                    .header("X-Service-Token", serviceToken)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .body(request)
                    .retrieve()
                    .toBodilessEntity();
            return true;
        } catch (RestClientException e) {
            log.error("[SafeVoiceEmail] failed to send new report email notification: {}", e.getMessage());
            return false;
        }
    }

    private record SendEmailRequest(
            List<String> to,
            List<String> cc,
            List<String> bcc,
            String subject,
            String textBody,
            String htmlBody) {
    }
}
