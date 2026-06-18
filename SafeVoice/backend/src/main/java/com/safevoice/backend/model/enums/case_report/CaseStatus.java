package com.safevoice.backend.model.enums.case_report;

/**
 * Status stages for the case reports lifecycle.
 */
public enum CaseStatus {
    RECEIVED,
    ACKNOWLEDGED,
    TRIAGE,
    INVESTIGATING,
    AWAITING_REPORTER,
    REMEDIATION,
    CLOSED
}
