package com.safevoice.backend.model.enums;

import lombok.Getter;

/**
 * Types of system notifications/alerts dispatched to compliance staff.
 */
@Getter
public enum NotificationType {
    NEW_REPORT("new_report"),
    ESCALATION("escalation"),
    SLA_WARNING("sla_warning"),
    UPDATE("update"),
    MESSAGE("message"),
    RETENTION("retention");

    private final String key;

    NotificationType(String key) {
        this.key = key;
    }
}
