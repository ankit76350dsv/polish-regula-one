package com.ksefflow.backend.security;

/**
 * The set of KSeF-module permission codes a user can hold.
 *
 * These codes live on the RegulaOne user (in its generic {@code permissions} list)
 * and arrive here via the /api/auth/me response. RegulaOne stays app-agnostic — it
 * just stores the strings — while THIS enum is the single place that defines what
 * the KSeF module recognises and what each code is allowed to do.
 *
 * Why an enum here (and only strings in RegulaOne)?
 *   - Keeps the identity service decoupled from every app's permission model.
 *   - Gives the KSeF code type-safety and one obvious place to look up the rules.
 *
 * Rough meaning of each code (enforcement is added per-endpoint as needed):
 *   - KSEF_TENANT_ADMIN      → full control inside the company's KSeF: manage
 *                              certificates, grant/revoke KSeF permissions, declare
 *                              emergency / offline mode.
 *   - KSEF_CASE_MANAGER      → day-to-day invoicing: create, submit, and correct
 *                              invoices (maps to KSeF's own "InvoiceWrite" right).
 *   - KSEF_COMPLIANCE_OFFICER→ oversight: read everything and run compliance checks,
 *                              but should not issue invoices (separation of duties).
 *   - KSEF_AUDITOR           → read-only access to invoices, UPOs, and audit logs,
 *                              plus export for the 10-year retention requirement.
 *   - KSEF_EMPLOYEE          → minimal access; baseline member with no invoicing rights.
 */
public enum KsefPermission {
    KSEF_TENANT_ADMIN,
    KSEF_CASE_MANAGER,
    KSEF_COMPLIANCE_OFFICER,
    KSEF_AUDITOR,
    KSEF_EMPLOYEE;

    /**
     * Safe lookup: returns the matching enum value, or null if the string is not a
     * KSeF code (e.g. it belongs to another app like WORKPULSE_*). Never throws.
     */
    public static KsefPermission fromCode(String code) {
        if (code == null) {
            return null;
        }
        for (KsefPermission p : values()) {
            if (p.name().equals(code)) {
                return p;
            }
        }
        return null;
    }
}
