package com.safevoice.backend.security;

/**
 * The set of SafeVoice-module permission codes a user can hold.
 *
 * These codes live on the RegulaOne user (its generic {@code permissions} list) and
 * arrive here via the /api/auth/me response. RegulaOne stays app-agnostic — it just
 * stores the strings — while THIS enum is the single place that defines what the
 * SafeVoice module recognises and what each code is allowed to do.
 *
 * They are granted/revoked by an admin in RegulaOne Team Management (the same screen
 * used for the KSeF codes); the catalogue the admin sees is in the RegulaOne frontend
 * (UserPermissionsPage.jsx). The codes below MUST match that catalogue exactly.
 *
 * Note: the whistleblower/reporter is NOT represented here. Reporters are anonymous
 * external users who authenticate with a tracking code + PIN, never via RegulaOne RBAC.
 */
public enum SafeVoicePermission {
    SAFEVOICE_ADMIN,        // full control: invite officers, manage retention/legal hold
    SAFEVOICE_COMPLIANCE_OFFICER,  // triage, status, assign investigator, message reporter
    SAFEVOICE_INVESTIGATOR,        // work assigned cases, add evidence, post messages
    SAFEVOICE_HR_MANAGER,          // handle HR-handoff (labour-dispute) cases only
    SAFEVOICE_AUDITOR;             // read-only: cases, audit logs, retention export

    /**
     * Safe lookup: returns the matching enum value, or null if the string is not a
     * SafeVoice code (e.g. it belongs to another app like KSEF_*). Never throws.
     */
    public static SafeVoicePermission fromCode(String code) {
        if (code == null) {
            return null;
        }
        for (SafeVoicePermission p : values()) {
            if (p.name().equals(code)) {
                return p;
            }
        }
        return null;
    }
}
