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

    private String title;

    private String description;

    private Instant timestamp;

    private boolean read = false;

    private NotificationType type;

    private UUID caseId;
}
