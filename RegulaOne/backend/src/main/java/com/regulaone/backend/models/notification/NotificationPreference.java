package com.regulaone.backend.models.notification;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Per-user notification preferences. Controls which CHANNELS a user receives, overall and
 * per-category. In-app is always on (it is the canonical store); preferences mainly gate the
 * off-channels (email/push) added in later phases.
 *
 * Security/legal-critical categories cannot be fully disabled — enforced in the service, not
 * here, so the stored preference can still record the user's choice.
 *
 * Map keys are the enum names (Strings) so MongoDB serialises them cleanly.
 */
@Document(collection = "notification_preferences")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationPreference {

    @Id
    private String id;

    @Indexed
    private String tenantId;

    @Indexed(unique = true)
    private String userId;

    // channel name (IN_APP/EMAIL/PUSH/...) → enabled
    @Builder.Default
    private Map<String, Boolean> channelDefaults = new HashMap<>();

    // category name (INVOICE/COMPLIANCE/...) → (channel name → enabled)
    @Builder.Default
    private Map<String, Map<String, Boolean>> perCategory = new HashMap<>();

    // Quiet hours — not applied to CRITICAL/security notifications.
    @Builder.Default
    private boolean quietHoursEnabled = false;
    private Integer quietHoursFromHour;   // 0–23
    private Integer quietHoursToHour;     // 0–23
    private String  timezone;

    // IMMEDIATE | HOURLY | DAILY (digest batching is a later-phase feature).
    @Builder.Default
    private String digestFrequency = "IMMEDIATE";

    private LocalDateTime updatedAt;

    /** Sensible defaults for a brand-new user: in-app + email + push on, immediate. */
    public static NotificationPreference defaultsFor(String tenantId, String userId) {
        Map<String, Boolean> channels = new HashMap<>();
        channels.put(NotificationChannel.IN_APP.name(), true);
        channels.put(NotificationChannel.EMAIL.name(), true);
        channels.put(NotificationChannel.PUSH.name(), true);
        return NotificationPreference.builder()
                .tenantId(tenantId)
                .userId(userId)
                .channelDefaults(channels)
                .perCategory(new HashMap<>())
                .digestFrequency("IMMEDIATE")
                .updatedAt(LocalDateTime.now())
                .build();
    }
}
