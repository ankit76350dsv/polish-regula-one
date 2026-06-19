package com.safevoice.backend.model.document;

import com.safevoice.backend.model.base.BaseDocument;
import com.safevoice.backend.model.enums.notification.NotificationType;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.UUID;

/**
 * MongoDB document representing compliance alerts and task notifications.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "notifications")
public class NotificationItem extends BaseDocument {

    /**
     * MUST remain generic and reference-only (e.g. "New Message Received").
     * DO NOT quote or copy content from whistleblower reports or messages to avoid storing unencrypted PII.
     */
    private String title;

    /**
     * MUST remain generic and reference-only (e.g. "A new message was added to case CR-123").
     * DO NOT quote or copy content from whistleblower reports or messages to avoid storing unencrypted PII.
     */
    private String description;

    private Instant timestamp;

    private boolean read = false;

    private NotificationType type;

    private UUID caseId;

    private String userId; // Specific recipient user ID; null for all tenant users
}
