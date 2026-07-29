package com.safevoice.backend.model.enums.case_report;

import lombok.Getter;

/**
 * Entry-points indicating how the report was registered.
 */
@Getter
public enum IntakeChannel {
    ANONYMOUS_WEB_PORTAL("Anonymous web portal"),
    CONFIDENTIAL_NAMED_PORTAL("Confidential named portal"),
    HR_GRIEVANCE_HANDOFF("HR grievance handoff");

    private final String label;

    IntakeChannel(String label) {
        this.label = label;
    }
}
