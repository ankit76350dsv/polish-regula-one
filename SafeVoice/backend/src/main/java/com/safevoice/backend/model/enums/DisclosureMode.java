package com.safevoice.backend.model.enums;

import lombok.Getter;

/**
 * Whistleblower identification configuration mode.
 */
@Getter
public enum DisclosureMode {
    ANONYMOUS("Anonymous"),
    CONFIDENTIAL_NAMED("Confidential Named"),
    HR_HANDOFF("HR Handoff");

    private final String label;

    DisclosureMode(String label) {
        this.label = label;
    }
}
