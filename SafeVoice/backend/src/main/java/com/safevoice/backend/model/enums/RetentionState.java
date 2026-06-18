package com.safevoice.backend.model.enums;

/**
 * Data retention state flags for compliance-driven auto-deletion.
 */
public enum RetentionState {
    ACTIVE,
    LEGAL_HOLD,
    DELETION_SCHEDULED,
    DESTROYED
}
