package com.regulaone.backend.models.notification;

// Delivery channels a notification can go out on. IN_APP is the canonical store and is
// always written; the others are layered on in later phases (email is Phase 3, push Phase 5).
public enum NotificationChannel {
    IN_APP,
    EMAIL,
    PUSH,
    SMS,
    TEAMS,
    SLACK,
    WEBHOOK
}
