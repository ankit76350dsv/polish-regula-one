package com.safevoice.backend.model.enums.audit;

/**
 * Audit actions recorded in the immutable compliance log.
 */
public enum AuditActionType {
    REPORT_RECEIVED,
    CASE_STATUS_CHANGED,
    SEVERITY_CHANGED,
    INVESTIGATOR_ASSIGNED,
    MESSAGE_POSTED,
    EVIDENCE_ADDED,
    EVIDENCE_EXPORTED,
    OFFICER_INVITED,
    RETENTION_UPDATED,
    LOGIN_SECURITY,
    ACCESS_REVIEW
}
