package com.regulaone.backend.dto.notification;

import com.regulaone.backend.models.notification.Notification;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

// UI-ready view of a single in-app notification.
@Data
@Builder
public class NotificationResponse {

    private String id;
    private String eventType;
    private String sourceModule;
    private String category;
    private String severity;
    private String title;
    private String body;
    private String relatedEntityType;
    private String relatedEntityId;
    private String status;
    private LocalDateTime readAt;
    private LocalDateTime createdAt;

    public static NotificationResponse from(Notification n) {
        return NotificationResponse.builder()
                .id(n.getId())
                .eventType(n.getEventType() != null ? n.getEventType().name() : null)
                .sourceModule(n.getSourceModule() != null ? n.getSourceModule().name() : null)
                .category(n.getCategory() != null ? n.getCategory().name() : null)
                .severity(n.getSeverity() != null ? n.getSeverity().name() : null)
                .title(n.getTitle())
                .body(n.getBody())
                .relatedEntityType(n.getRelatedEntityType())
                .relatedEntityId(n.getRelatedEntityId())
                .status(n.getStatus() != null ? n.getStatus().name() : null)
                .readAt(n.getReadAt())
                .createdAt(n.getCreatedAt())
                .build();
    }
}
