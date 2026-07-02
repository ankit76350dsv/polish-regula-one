package com.safevoice.backend.service.notification;

import com.safevoice.backend.model.document.RegulaOneUser;
import com.safevoice.backend.repository.RegulaOneUserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class SafeVoiceEmailNotificationService {

    private static final List<String> NEW_REPORT_RECIPIENT_PERMISSIONS = List.of(
            "SAFEVOICE_ADMIN",
            "SAFEVOICE_COMPLIANCE_OFFICER",
            "SAFEVOICE_INVESTIGATOR",
            "SAFEVOICE_HR_MANAGER"
    );

    // A brand-new report arrived.
    private static final String NEW_REPORT_SUBJECT = "A SafeVoice case requires your attention";
    private static final String NEW_REPORT_TEXT = """
            A new SafeVoice case requires attention.

            Sign in to RegulaOne SafeVoice to review it.
            """;
    private static final String NEW_REPORT_HTML = """
            <p>A new SafeVoice case requires attention.</p>
            <p>Sign in to RegulaOne SafeVoice to review it.</p>
            """;

    // A case is approaching (or has passed) its 3-month feedback deadline.
    private static final String FEEDBACK_DEADLINE_SUBJECT = "A SafeVoice case is nearing its response deadline";
    private static final String FEEDBACK_DEADLINE_TEXT = """
            A SafeVoice case is approaching (or has passed) its legal feedback deadline.

            Sign in to RegulaOne SafeVoice to review and respond.
            """;
    private static final String FEEDBACK_DEADLINE_HTML = """
            <p>A SafeVoice case is approaching (or has passed) its legal feedback deadline.</p>
            <p>Sign in to RegulaOne SafeVoice to review and respond.</p>
            """;

    // A reporter checked their case (via a valid access key) and is waiting for a response.
    private static final String REPORTER_WAITING_SUBJECT = "A SafeVoice reporter is waiting for your response";
    private static final String REPORTER_WAITING_TEXT = """
            A SafeVoice reporter has checked their case and is waiting for a response.

            Sign in to RegulaOne SafeVoice to review it.
            """;
    private static final String REPORTER_WAITING_HTML = """
            <p>A SafeVoice reporter has checked their case and is waiting for a response.</p>
            <p>Sign in to RegulaOne SafeVoice to review it.</p>
            """;

    private final RegulaOneUserRepository userRepository;
    private final RestClient emailClient;
    private final String serviceToken;
    private final boolean notificationsEnabled;

    // Per-case cooldown for the "reporter is waiting" email, so a reporter refreshing/re-checking
    // their status does not spam staff — at most one email per case per cooldown window.
    // In-memory (single instance); a multi-node deployment would send at most one email per node.
    private final long reporterWaitingCooldownMs;
    private final Map<String, Long> reporterWaitingLastSentMs = new ConcurrentHashMap<>();
    private static final int MAX_TRACKED_CASES = 100_000;

    public SafeVoiceEmailNotificationService(
            RegulaOneUserRepository userRepository,
            @Value("${regulaone.api.base-url}") String baseUrl,
            @Value("${regulaone.api.connect-timeout-ms:3000}") int connectTimeoutMs,
            @Value("${regulaone.api.read-timeout-ms:5000}") int readTimeoutMs,
            @Value("${regulaone.email.service-token:}") String serviceToken,
            @Value("${safevoice.email-notifications.enabled:true}") boolean notificationsEnabled,
            @Value("${safevoice.email-notifications.reporter-waiting-cooldown-ms:1800000}") long reporterWaitingCooldownMs) {
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
        this.reporterWaitingCooldownMs = reporterWaitingCooldownMs;
    }

    // Runs on the background email pool (see AsyncConfig) so the reporter's submit returns
    // immediately — the report is already saved by the time this fires, and email is best-effort.
    @Async("emailNotificationExecutor")
    public void notifyNewReport(String tenantId) {
        dispatch(tenantId, "new report", NEW_REPORT_SUBJECT, NEW_REPORT_TEXT, NEW_REPORT_HTML);
    }

    // Runs on the background email pool so the reporter's status lookup (/track) returns
    // immediately. Fired when a reporter opens their case with a valid access key — a signal they
    // are waiting for a reply. Best-effort, content-free (no case detail leaves the system).
    // Throttled to at most ONE email per case per cooldown window so repeated status checks by
    // the same reporter do not spam staff.
    @Async("emailNotificationExecutor")
    public void notifyReporterWaiting(String tenantId, String caseId) {
        if (!withinCooldownAllows(caseId)) {
            log.debug("[SafeVoiceEmail] reporter-waiting email suppressed by cooldown; caseId={}", caseId);
            return;
        }
        dispatch(tenantId, "reporter waiting", REPORTER_WAITING_SUBJECT, REPORTER_WAITING_TEXT, REPORTER_WAITING_HTML);
    }

    // Atomically decide whether a "reporter waiting" email may be sent for this case now, and if
    // so record the send time. Returns true to send. Using compute() makes the check-and-set
    // atomic, so two near-simultaneous status checks can never both slip through.
    private boolean withinCooldownAllows(String caseId) {
        if (caseId == null || caseId.isBlank()) {
            return true; // nothing to throttle on — allow
        }
        long now = System.currentTimeMillis();
        boolean[] allow = {false};
        reporterWaitingLastSentMs.compute(caseId, (key, lastSent) -> {
            if (lastSent == null || now - lastSent >= reporterWaitingCooldownMs) {
                allow[0] = true;
                return now; // record this send
            }
            return lastSent; // still cooling down — keep the old time, don't send
        });
        // Keep the map from growing without bound: drop entries whose cooldown has fully elapsed.
        if (reporterWaitingLastSentMs.size() > MAX_TRACKED_CASES) {
            reporterWaitingLastSentMs.entrySet()
                    .removeIf(entry -> now - entry.getValue() >= reporterWaitingCooldownMs);
        }
        return allow[0];
    }

    // Runs on the background email pool. Fired by the compliance job when a case nears/passes its
    // 3-month feedback deadline — one email per tenant per escalation run. Content-free.
    @Async("emailNotificationExecutor")
    public void notifyFeedbackDeadline(String tenantId) {
        dispatch(tenantId, "feedback deadline", FEEDBACK_DEADLINE_SUBJECT, FEEDBACK_DEADLINE_TEXT, FEEDBACK_DEADLINE_HTML);
    }

    // Shared sender: resolve the tenant's eligible staff and email each one the same content-free
    // alert. `kind` is only used in logs. Never throws — email is best-effort.
    private void dispatch(String tenantId, String kind, String subject, String textBody, String htmlBody) {
        if (!notificationsEnabled) {
            return;
        }
        if (tenantId == null || tenantId.isBlank()) {
            log.warn("[SafeVoiceEmail] skipped {} email: missing tenant id", kind);
            return;
        }
        if (serviceToken == null || serviceToken.isBlank()) {
            log.error("[SafeVoiceEmail] regulaone.email.service-token is not configured; {} email skipped", kind);
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
            log.info("[SafeVoiceEmail] no eligible recipients for {} notification; tenantId={}", kind, tenantId);
            return;
        }

        int sentCount = 0;
        for (String recipient : recipients) {
            if (sendToRecipient(recipient, subject, textBody, htmlBody)) {
                sentCount++;
            }
        }
        log.info("[SafeVoiceEmail] sent {} email notification to {}/{} eligible recipients; tenantId={}",
                kind, sentCount, recipients.size(), tenantId);
    }

    private boolean sendToRecipient(String recipient, String subject, String textBody, String htmlBody) {
        SendEmailRequest request = new SendEmailRequest(
                List.of(recipient),
                List.of(),
                List.of(),
                subject,
                textBody,
                htmlBody
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
            log.error("[SafeVoiceEmail] failed to send email notification: {}", e.getMessage());
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
