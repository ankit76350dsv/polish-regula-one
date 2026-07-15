package com.privacypilot.backend.model.enums.breach;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * Whether a personal-data breach case is still being handled (OPEN) or has been
 * fully dealt with and documented (CLOSED). Breaches must be recorded either way
 * under Art. 33(5) GDPR, even when they are not reported to the authority.
 */
@Getter
public enum BreachStatus {
    OPEN("open"),
    CLOSED("closed");

    private final String code;

    BreachStatus(String code) {
        this.code = code;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    @JsonCreator
    public static BreachStatus fromCode(String code) {
        if (code != null) {
            for (BreachStatus v : values()) {
                if (v.code.equalsIgnoreCase(code.trim()) || v.name().equalsIgnoreCase(code.trim())) {
                    return v;
                }
            }
        }
        throw new IllegalArgumentException("Unknown breach status: " + code);
    }
}
