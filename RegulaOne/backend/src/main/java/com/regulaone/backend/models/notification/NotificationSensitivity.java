package com.regulaone.backend.models.notification;

// Controls how much content may leave the in-app channel (data minimization, GDPR Art. 5(1)(c)).
//   NORMAL       — content may appear in email/push.
//   CONFIDENTIAL — limited content off-channel.
//   RESTRICTED   — NO content in email/push (whistleblower, security); only a "sign in to view" pointer.
public enum NotificationSensitivity {
    NORMAL,
    CONFIDENTIAL,
    RESTRICTED
}
