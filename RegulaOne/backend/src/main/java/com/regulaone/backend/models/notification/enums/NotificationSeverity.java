package com.regulaone.backend.models.notification.enums;

// Drives the UI badge colour and whether the notification is treated as non-disableable.
// CRITICAL / security notifications ignore quiet-hours and channel opt-outs.
public enum NotificationSeverity {
    INFO,
    SUCCESS,
    WARNING,
    ERROR,
    CRITICAL
}
