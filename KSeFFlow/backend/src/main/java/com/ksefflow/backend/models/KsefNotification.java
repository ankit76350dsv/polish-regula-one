package com.ksefflow.backend.models;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import com.ksefflow.backend.models.utils.KsefNotificationType;


import java.time.LocalDateTime;

// In-app notification shown in the KSeFFlow notification panel.
//
// Notifications are tenant-scoped. A null userId means the notification is
// broadcast to all users in the tenant (e.g. "KSeF API is back online").
// A non-null userId targets a specific user (e.g. "Your invoice was rejected").
//
// Typical triggers:
//   - Invoice status change (SENT, FAILED, OFFLINE_MODE)
//   - Certificate expiry warning (30 days, 7 days)
//   - KSeF government API status change (goes down / comes back up)
//   - Offline queue flush results (X invoices submitted, Y failed)
//   - Session authentication events
@Document(collection = "ksef_notifications")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndex(def = "{'tenantId': 1, 'read': 1, 'createdAt': -1}")
public class KsefNotification {

    @Id
    private String id;

    // ── Targeting ──────────────────────────────────────────────────────────────

    @Indexed
    private String tenantId;

    // Null = broadcast to all tenant users; non-null = specific user only
    private String userId;

    // ── Content ────────────────────────────────────────────────────────────────

    private String title;
    private String message;

    @Builder.Default
    private KsefNotificationType type = KsefNotificationType.INFO;

    // ── Read state ─────────────────────────────────────────────────────────────

    @Builder.Default
    private boolean read = false;

    // Populated when the user opens the notification panel and the bell counter clears
    private LocalDateTime readAt;

    // ── Related entity ─────────────────────────────────────────────────────────
    // Optional deep-link so the UI can navigate to the relevant invoice/certificate

    private String relatedEntityId;

    // "INVOICE", "CERTIFICATE", "SESSION", "QUEUE"
    private String relatedEntityType;

    // ── Timestamps ─────────────────────────────────────────────────────────────

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
