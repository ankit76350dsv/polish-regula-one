package com.regulaone.backend.controllers;

import com.regulaone.backend.dto.AppResponse;
import com.regulaone.backend.dto.notification.IngestResult;
import com.regulaone.backend.dto.notification.NotificationEvent;
import com.regulaone.backend.services.notification.NotificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * INTERNAL service-to-service API. Modules (KSeFFlow, etc.) POST a {@link NotificationEvent}
 * here to raise notifications. This is NOT user-authenticated — it is guarded by a shared
 * service token in the {@code X-Service-Token} header, compared to the configured value.
 *
 * The route is permitted in SecurityConfig (no JWT); the token check below is its gate.
 * Configure the token via the NOTIFICATION_INTERNAL_TOKEN environment variable.
 */
@Slf4j
@RestController
@RequestMapping("/api/internal/notifications")
@RequiredArgsConstructor
public class NotificationIngestController {

    private final NotificationService notificationService;

    @Value("${notification.internal.service-token:}")
    private String serviceToken;

    @PostMapping("/events")
    public ResponseEntity<AppResponse<IngestResult>> ingest(
            @RequestHeader(value = "X-Service-Token", required = false) String token,
            @Valid @RequestBody NotificationEvent event) {

        requireServiceToken(token);
        IngestResult result = notificationService.ingest(event);
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(AppResponse.success("Event ingested", result));
    }

    // Reject unless the caller presents the configured service token. If no token is
    // configured the endpoint is closed by default (fail-safe) rather than open.
    private void requireServiceToken(String token) {
        if (serviceToken == null || serviceToken.isBlank()) {
            log.error("[ingest] notification.internal.service-token is not configured — rejecting");
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Notification ingest is not configured");
        }
        if (token == null || !constantTimeEquals(serviceToken, token)) {
            log.warn("[ingest] invalid or missing X-Service-Token — rejected");
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid service token");
        }
    }

    // Constant-time comparison so a wrong token cannot be guessed by timing.
    private boolean constantTimeEquals(String a, String b) {
        if (a.length() != b.length()) return false;
        int diff = 0;
        for (int i = 0; i < a.length(); i++) diff |= a.charAt(i) ^ b.charAt(i);
        return diff == 0;
    }
}
