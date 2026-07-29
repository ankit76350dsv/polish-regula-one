package com.regulaone.backend.models.notification.enums;

// Lifecycle of an in-app notification row (per recipient).
//   UNREAD → READ (user opens it) → ARCHIVED (user clears it); soft-delete on top.
public enum NotificationStatus {
    UNREAD,
    READ,
    ARCHIVED
}
