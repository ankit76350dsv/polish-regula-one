package com.regulaone.backend.models.notification;

import com.regulaone.backend.models.notification.enums.*;
import java.util.List;

/**
 * The catalogue of business events that produce notifications, plus the DEFAULT routing for
 * each one: category, severity, sensitivity, channels, and which permission codes should
 * receive it.
 *
 * This is the permission/routing model in code form (see docs/notification-architecture.md §6).
 * A publishing module sends an event of one of these types; the Hub looks up the defaults here
 * and resolves recipients = users in the tenant holding ANY of {@link #audiencePermissions}.
 *
 * Events whose audience is a specific person (assignee, uploader, affected user, whistleblower
 * reviewer) carry an EMPTY audience here — the publisher supplies explicit recipientUserIds.
 */
public enum NotificationEventType {

    // ── Invoicing (KSeFFlow) ────────────────────────────────────────────────────
    INVOICE_SUBMISSION_FAILED(NotificationCategory.INVOICE, NotificationSeverity.ERROR, NotificationSensitivity.NORMAL,
            List.of(NotificationChannel.IN_APP, NotificationChannel.EMAIL),
            List.of("KSEF_CASE_MANAGER", "KSEF_TENANT_ADMIN")),
    INVOICE_REJECTED(NotificationCategory.INVOICE, NotificationSeverity.ERROR, NotificationSensitivity.NORMAL,
            List.of(NotificationChannel.IN_APP, NotificationChannel.EMAIL),
            List.of("KSEF_CASE_MANAGER", "KSEF_TENANT_ADMIN")),
    INVOICE_VALIDATION_ERROR(NotificationCategory.INVOICE, NotificationSeverity.WARNING, NotificationSensitivity.NORMAL,
            List.of(NotificationChannel.IN_APP, NotificationChannel.EMAIL),
            List.of("KSEF_CASE_MANAGER", "KSEF_TENANT_ADMIN")),
    INVOICE_RETRY_FAILED(NotificationCategory.INVOICE, NotificationSeverity.ERROR, NotificationSensitivity.NORMAL,
            List.of(NotificationChannel.IN_APP, NotificationChannel.EMAIL),
            List.of("KSEF_CASE_MANAGER", "KSEF_TENANT_ADMIN", "KSEF_COMPLIANCE_OFFICER")),
    INVOICE_SENT(NotificationCategory.INVOICE, NotificationSeverity.SUCCESS, NotificationSensitivity.NORMAL,
            List.of(NotificationChannel.IN_APP),
            List.of("KSEF_CASE_MANAGER", "KSEF_TENANT_ADMIN")),

    // ── KSeF availability / integration ─────────────────────────────────────────
    KSEF_COMMUNICATION_FAILURE(NotificationCategory.SYSTEM, NotificationSeverity.WARNING, NotificationSensitivity.NORMAL,
            List.of(NotificationChannel.IN_APP, NotificationChannel.EMAIL),
            List.of("KSEF_TENANT_ADMIN", "KSEF_CASE_MANAGER", "KSEF_COMPLIANCE_OFFICER", "KSEF_AUDITOR", "KSEF_EMPLOYEE")),
    KSEF_EMERGENCY_DECLARED(NotificationCategory.SYSTEM, NotificationSeverity.CRITICAL, NotificationSensitivity.NORMAL,
            List.of(NotificationChannel.IN_APP, NotificationChannel.EMAIL),
            List.of("KSEF_TENANT_ADMIN", "KSEF_CASE_MANAGER", "KSEF_COMPLIANCE_OFFICER", "KSEF_AUDITOR", "KSEF_EMPLOYEE")),
    INTEGRATION_ERROR(NotificationCategory.SYSTEM, NotificationSeverity.ERROR, NotificationSensitivity.NORMAL,
            List.of(NotificationChannel.IN_APP, NotificationChannel.EMAIL),
            List.of("KSEF_TENANT_ADMIN")),
    PIPELINE_EXECUTION_FAILURE(NotificationCategory.SYSTEM, NotificationSeverity.ERROR, NotificationSensitivity.NORMAL,
            List.of(NotificationChannel.IN_APP, NotificationChannel.EMAIL),
            List.of("KSEF_TENANT_ADMIN")),

    // ── Certificates / authentication ───────────────────────────────────────────
    CERTIFICATE_ISSUE(NotificationCategory.CERTIFICATE, NotificationSeverity.WARNING, NotificationSensitivity.NORMAL,
            List.of(NotificationChannel.IN_APP, NotificationChannel.EMAIL),
            List.of("KSEF_TENANT_ADMIN")),

    // ── Workflow / tasks (recipient is a specific person → explicit recipients) ──
    WORKFLOW_APPROVAL_PENDING(NotificationCategory.WORKFLOW, NotificationSeverity.INFO, NotificationSensitivity.CONFIDENTIAL,
            List.of(NotificationChannel.IN_APP, NotificationChannel.EMAIL), List.of()),
    WORKFLOW_APPROVAL_REJECTED(NotificationCategory.WORKFLOW, NotificationSeverity.WARNING, NotificationSensitivity.CONFIDENTIAL,
            List.of(NotificationChannel.IN_APP, NotificationChannel.EMAIL), List.of()),
    TASK_ASSIGNED(NotificationCategory.WORKFLOW, NotificationSeverity.INFO, NotificationSensitivity.NORMAL,
            List.of(NotificationChannel.IN_APP, NotificationChannel.EMAIL), List.of()),
    DOCUMENT_UPLOAD_FAILED(NotificationCategory.SYSTEM, NotificationSeverity.WARNING, NotificationSensitivity.NORMAL,
            List.of(NotificationChannel.IN_APP), List.of()),

    // ── Compliance / reporting (audience is module-specific → set via event override) ──
    REPORT_SUBMITTED(NotificationCategory.COMPLIANCE, NotificationSeverity.INFO, NotificationSensitivity.NORMAL,
            List.of(NotificationChannel.IN_APP, NotificationChannel.EMAIL), List.of()),
    COMPLIANCE_DEADLINE_APPROACHING(NotificationCategory.COMPLIANCE, NotificationSeverity.WARNING, NotificationSensitivity.NORMAL,
            List.of(NotificationChannel.IN_APP, NotificationChannel.EMAIL), List.of()),

    // ── Security (affected user only) ────────────────────────────────────────────
    AUTH_SECURITY_EVENT(NotificationCategory.SECURITY, NotificationSeverity.WARNING, NotificationSensitivity.RESTRICTED,
            List.of(NotificationChannel.IN_APP, NotificationChannel.EMAIL), List.of()),

    // ── Whistleblower (SafeVoice) — reviewer-only, content-free off-channel ──────
    WHISTLEBLOWER_REPORT_RECEIVED(NotificationCategory.COMPLIANCE, NotificationSeverity.WARNING, NotificationSensitivity.RESTRICTED,
            List.of(NotificationChannel.IN_APP), List.of()),

    // ── Fallback ─────────────────────────────────────────────────────────────────
    GENERIC(NotificationCategory.SYSTEM, NotificationSeverity.INFO, NotificationSensitivity.NORMAL,
            List.of(NotificationChannel.IN_APP), List.of());

    private final NotificationCategory category;
    private final NotificationSeverity severity;
    private final NotificationSensitivity sensitivity;
    private final List<NotificationChannel> defaultChannels;
    private final List<String> audiencePermissions;

    NotificationEventType(NotificationCategory category, NotificationSeverity severity,
                          NotificationSensitivity sensitivity, List<NotificationChannel> defaultChannels,
                          List<String> audiencePermissions) {
        this.category = category;
        this.severity = severity;
        this.sensitivity = sensitivity;
        this.defaultChannels = defaultChannels;
        this.audiencePermissions = audiencePermissions;
    }

    public NotificationCategory getCategory() { return category; }
    public NotificationSeverity getSeverity() { return severity; }
    public NotificationSensitivity getSensitivity() { return sensitivity; }
    public List<NotificationChannel> getDefaultChannels() { return defaultChannels; }
    public List<String> getAudiencePermissions() { return audiencePermissions; }

    // Safe lookup — unknown/blank type falls back to GENERIC instead of throwing.
    public static NotificationEventType fromCode(String code) {
        if (code == null) return GENERIC;
        for (NotificationEventType t : values()) {
            if (t.name().equalsIgnoreCase(code)) return t;
        }
        return GENERIC;
    }
}
