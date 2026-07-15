package com.privacypilot.backend.model.enums.activity;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * The life stage of a record-of-processing entry (a ROPA activity):
 *  - DRAFT: still being written, not final.
 *  - IN_REVIEW: waiting for a DPO / admin to check it.
 *  - APPROVED: signed off and part of the official register.
 */
@Getter
public enum ActivityStatus {
    DRAFT("draft"),
    IN_REVIEW("in_review"),
    APPROVED("approved");

    private final String code;

    ActivityStatus(String code) {
        this.code = code;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    @JsonCreator
    public static ActivityStatus fromCode(String code) {
        if (code != null) {
            for (ActivityStatus v : values()) {
                if (v.code.equalsIgnoreCase(code.trim()) || v.name().equalsIgnoreCase(code.trim())) {
                    return v;
                }
            }
        }
        throw new IllegalArgumentException("Unknown activity status: " + code);
    }
}
