package com.regulaone.backend.models.notification;

import com.regulaone.backend.models.notification.enums.*;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * An in-app notification — ONE row per recipient (never a broadcast-by-null row), so we can
 * scope by permission, track per-user read state, and honour one user's right-to-erasure.
 *
 * Multi-tenancy: every query MUST filter by tenantId (resolved from the verified session,
 * never from client input).
 *
 * Content here is the canonical store. Email/push (later phases) carry only a pointer for
 * RESTRICTED items — the sensitive content stays behind authenticated in-app access.
 */
@Document(collection = "notifications")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndex(def = "{'tenantId': 1, 'recipientUserId': 1, 'status': 1, 'createdAt': -1}")
public class Notification {

    @Id
    private String id;

    // ── Targeting (tenant-scoped, resolved to a single recipient) ───────────────
    @Indexed
    private String tenantId;

    @Indexed
    private String recipientUserId;   // RegulaOne User._id

    // ── Classification ──────────────────────────────────────────────────────────
    private NotificationEventType eventType;
    // Origin app/module. Doubles as the per-app filter key — the frontend maps this to a
    // display name (e.g. KSEFFLOW → "KSeFFlow") and shows only its own app's notifications.
    @Indexed
    private SourceModule sourceModule;
    private NotificationCategory category;
    private NotificationSeverity severity;
    private NotificationSensitivity sensitivity;

    // ── Content (data-minimized — see NotificationSensitivity) ──────────────────
    private String title;
    private String body;

    // Deep link target — a POINTER, not the sensitive payload. Access re-checked on that page.
    private String relatedEntityType;   // e.g. "INVOICE", "CERTIFICATE", "CASE"
    private String relatedEntityId;

    // ── Read state ───────────────────────────────────────────────────────────────
    @Builder.Default
    private NotificationStatus status = NotificationStatus.UNREAD;
    private LocalDateTime readAt;

    // ── Misc ──────────────────────────────────────────────────────────────────────
    @Builder.Default
    private String locale = "pl";

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    // When the in-app row should auto-archive/expire (storage limitation, Art. 5(1)(e)).
    private LocalDateTime expiresAt;

    // Soft delete — keeps delivery-audit integrity while honouring user deletion.
    @Builder.Default
    private boolean softDeleted = false;
    private LocalDateTime deletedAt;
}
