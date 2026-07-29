package com.ksefflow.backend.notification;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Publishes business events from KSeFFlow to the centralized notification Hub in RegulaOne
 * (POST /api/internal/notifications/events), instead of KSeFFlow holding its own notification
 * store. The Hub resolves WHO should receive each event (by permission) and how to deliver it.
 *
 * Design:
 *   - Server-to-server, authenticated with the shared X-Service-Token header (same secret the
 *     Hub checks). Uses the same RegulaOne base URL the auth client already talks to.
 *   - BEST-EFFORT: a notification must NEVER break a business flow. Any failure (Hub down,
 *     bad token, timeout) is logged and swallowed — the invoice/retry logic carries on.
 *   - Idempotent: callers pass a stable dedupeKey so a re-published event creates no duplicate.
 */
@Slf4j
@Component
public class HubNotificationPublisher {

    private final RestClient restClient;
    private final String serviceToken;

    public HubNotificationPublisher(@Value("${regulaone.api.base-url}") String baseUrl,
                                    @Value("${notification.internal.service-token:}") String serviceToken) {
        this.restClient = RestClient.builder().baseUrl(baseUrl).build();
        this.serviceToken = serviceToken;
        log.info("[HubNotificationPublisher]:1 Initialised — Hub base URL: {}", baseUrl);
    }

    /** Convenience for invoice-scoped events (the common case). */
    public void publishInvoiceEvent(String eventType, String tenantId, String title, String body,
                                    String invoiceId, String dedupeKey) {
        publish(new NotificationEventRequest(
                eventType, tenantId, "KSEFFLOW", title, body, null,
                "INVOICE", invoiceId, null, null, dedupeKey, LocalDateTime.now().toString()));
    }

    /** Send any event to the Hub. Never throws — failures are logged only. */
    public void publish(NotificationEventRequest event) {
        if (serviceToken == null || serviceToken.isBlank()) {
            log.warn("[HubNotificationPublisher]:2 service token not configured — skipping publish of {} (tenant {})",
                    event.eventType(), event.tenantId());
            return;
        }
        try {
            restClient.post()
                    .uri("/api/internal/notifications/events")
                    .header("X-Service-Token", serviceToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(event)
                    .retrieve()
                    .toBodilessEntity();
            log.info("[HubNotificationPublisher]:3 published {} tenant={}", event.eventType(), event.tenantId());
        } catch (Exception e) {
            // Best-effort — do NOT propagate; the business operation already succeeded.
            log.error("[HubNotificationPublisher]:4 failed to publish {} for tenant {}: {}",
                    event.eventType(), event.tenantId(), e.getMessage());
        }
    }

    /**
     * JSON body mirroring RegulaOne's NotificationEvent DTO. Nulls are omitted so the Hub
     * applies its event-type defaults (category/severity/audience).
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record NotificationEventRequest(
            String eventType,
            String tenantId,
            String sourceModule,
            String title,
            String body,
            String severity,
            String relatedEntityType,
            String relatedEntityId,
            List<String> recipientUserIds,
            List<String> audiencePermissions,
            String dedupeKey,
            String occurredAt) {
    }
}
