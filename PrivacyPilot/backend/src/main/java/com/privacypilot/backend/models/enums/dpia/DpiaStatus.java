package com.privacypilot.backend.model.enums.dpia;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * The life stage of a Data Protection Impact Assessment (DPIA):
 *  - DRAFT: still being filled in.
 *  - IN_PROGRESS: risks assessed, waiting for sign-off.
 *  - APPROVED: signed off by the DPO / admin.
 *  - REJECTED: sent back because the assessment is not acceptable yet.
 */
@Getter
public enum DpiaStatus {
    DRAFT("draft"),
    IN_PROGRESS("in_progress"),
    APPROVED("approved"),
    REJECTED("rejected");

    private final String code;

    DpiaStatus(String code) {
        this.code = code;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    @JsonCreator
    public static DpiaStatus fromCode(String code) {
        if (code != null) {
            for (DpiaStatus v : values()) {
                if (v.code.equalsIgnoreCase(code.trim()) || v.name().equalsIgnoreCase(code.trim())) {
                    return v;
                }
            }
        }
        throw new IllegalArgumentException("Unknown DPIA status: " + code);
    }
}
