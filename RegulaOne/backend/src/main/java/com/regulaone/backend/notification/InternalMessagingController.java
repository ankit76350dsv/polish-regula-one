package com.regulaone.backend.notification;

import com.regulaone.backend.common.AppResponse;
import com.regulaone.backend.common.ServiceTokenGuard;
import com.regulaone.backend.notification.dto.IngestResult;
import com.regulaone.backend.notification.dto.NotificationEvent;
import com.regulaone.backend.notification.dto.SendEmail;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * INTERNAL service-to-service messaging API — the two endpoints that other RegulaOne
 * applications (KSeFFlow, SafeVoice, …) call directly, machine to machine.
 *
 *   POST /api/internal/notifications/events  — raise a notification from a module event
 *   POST /api/email/send                     — send one e-mail through AWS SES
 *
 * WHY THESE TWO LIVE TOGETHER
 *   They are the same KIND of endpoint: no browser, no user session, no JWT. Both are
 *   permitted in SecurityConfig and both are gated instead by the shared
 *   {@code X-Service-Token} header. They were previously two controllers that each
 *   carried their OWN copy of that token check — the same security rule written
 *   twice. Now one class holds both routes and the check itself lives in
 *   {@link ServiceTokenGuard}, so there is exactly one implementation of it.
 *
 * NOTE ON THE PATHS
 *   The two routes do not share a URL prefix, so this class deliberately has no
 *   class-level {@code @RequestMapping}: each method states its full path, exactly as
 *   the callers already know them. Nothing about either URL has changed.
 *
 * SECURITY
 *   Every method here MUST call {@link ServiceTokenGuard#require} as its first
 *   statement. There is no user identity to fall back on, so the token IS the
 *   authorisation.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class InternalMessagingController {

    private final NotificationService notificationService;
    private final EmailService emailService;
    private final ServiceTokenGuard serviceTokenGuard;

    /**
     * A module reports that something happened; the Hub turns it into notifications
     * for whoever is entitled to act on it.
     *
     * Answers 202 Accepted — the event has been taken, and the response says how many
     * people it reached.
     */
    @PostMapping("/api/internal/notifications/events")
    public ResponseEntity<AppResponse<IngestResult>> ingest(
            @RequestHeader(value = "X-Service-Token", required = false) String token,
            @Valid @RequestBody NotificationEvent event) {

        serviceTokenGuard.require(token, "ingest", "Notification ingest is not configured");

        IngestResult result = notificationService.ingest(event);
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(AppResponse.success("Event ingested", result));
    }

    /**
     * Send one e-mail on behalf of a calling module.
     *
     * The token check happens BEFORE the try/catch on purpose: a rejected caller must
     * get 401/503 from the guard, and must not be folded into the 500 below.
     */
    @PostMapping("/api/email/send")
    public ResponseEntity<?> sendEmail(
            @RequestHeader(value = "X-Service-Token", required = false) String token,
            @RequestBody SendEmail request) {

        serviceTokenGuard.require(token, "email", "Email sending is not configured");

        try {
            emailService.sendEmail(request);
            return ResponseEntity.ok().body(
                    Map.of("success", true, "message", "Email sent successfully"));
        } catch (Exception e) {
            // The sending failure itself is reported to the calling service so it can
            // retry; the message is a mail-provider message, not user data.
            return ResponseEntity.internalServerError().body(
                    Map.of("success", false, "message", e.getMessage()));
        }
    }
}
