package com.privacypilot.backend.model.enums.common;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * A simple low / medium / high rating.
 * Used for vendor risk and data-breach risk.
 * The frontend sends the lowercase word (e.g. "high"), so we keep that spelling
 * as the "code" that travels over the API.
 */
@Getter
public enum RiskLevel {
    LOW("low"),
    MEDIUM("medium"),
    HIGH("high");

    private final String code;

    RiskLevel(String code) {
        this.code = code;
    }

    // What the API sends/receives for this value (the lowercase word).
    @JsonValue
    public String getCode() {
        return code;
    }

    // Turn the word coming from the frontend back into the enum. Ignores case.
    @JsonCreator
    public static RiskLevel fromCode(String code) {
        if (code != null) {
            for (RiskLevel v : values()) {
                if (v.code.equalsIgnoreCase(code.trim()) || v.name().equalsIgnoreCase(code.trim())) {
                    return v;
                }
            }
        }
        throw new IllegalArgumentException("Unknown risk level: " + code);
    }
}
