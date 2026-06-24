package com.regulaone.backend.dto.notification;

import com.regulaone.backend.models.notification.SourceModule;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * The contract a module sends to the Hub's internal ingest API to raise a notification.
 *
 * Recipient resolution:
 *   - If {@link #recipientUserIds} is provided, those exact users are targeted (e.g. an
 *     assignee, an uploader, an affected user, a whistleblower reviewer).
 *   - Otherwise the Hub resolves recipients = users in {@link #tenantId} holding ANY of
 *     {@link #audiencePermissions} (falling back to the event type's default audience).
 *
 * {@link #dedupeKey} makes publishing idempotent (safe to retry).
 */
@Data
public class NotificationEvent {

    // Event type name — maps to NotificationEventType (unknown → GENERIC).
    @NotBlank
    private String eventType;

    @NotBlank
    private String tenantId;

    private SourceModule sourceModule;

    // Human-readable content. Keep titles/bodies data-minimized; the Hub will not put
    // RESTRICTED content into off-channels regardless.
    private String title;
    private String body;

    // Optional severity/category overrides (else taken from the event type defaults).
    private String severity;

    // Deep-link pointer (not the sensitive payload).
    private String relatedEntityType;
    private String relatedEntityId;

    // Explicit recipients (person-targeted events). Wins over audiencePermissions.
    private List<String> recipientUserIds;

    // Permission codes whose holders should receive this (else event-type default audience).
    private List<String> audiencePermissions;

    // Stable idempotency key, e.g. "INVOICE_RETRY_FAILED:<invoiceId>".
    private String dedupeKey;

    private LocalDateTime occurredAt;
}
