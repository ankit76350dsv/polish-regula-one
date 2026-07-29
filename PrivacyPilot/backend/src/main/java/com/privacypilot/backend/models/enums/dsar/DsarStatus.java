package com.privacypilot.backend.model.enums.dsar;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * The progress of a data-subject request:
 *  - IN_PROGRESS: being worked on within the one-month deadline.
 *  - COMPLETED: answered and closed.
 *  - REFUSED: lawfully declined (e.g. manifestly unfounded/excessive, Art. 12(5)).
 */
@Getter
public enum DsarStatus {
    IN_PROGRESS("in_progress"),
    COMPLETED("completed"),
    REFUSED("refused");

    private final String code;

    DsarStatus(String code) {
        this.code = code;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    @JsonCreator
    public static DsarStatus fromCode(String code) {
        if (code != null) {
            for (DsarStatus v : values()) {
                if (v.code.equalsIgnoreCase(code.trim()) || v.name().equalsIgnoreCase(code.trim())) {
                    return v;
                }
            }
        }
        throw new IllegalArgumentException("Unknown DSAR status: " + code);
    }
}
