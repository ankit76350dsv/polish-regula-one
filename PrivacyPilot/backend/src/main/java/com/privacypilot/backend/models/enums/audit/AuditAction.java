package com.privacypilot.backend.model.enums.audit;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * The kind of action recorded in the audit trail (WHAT the user did). These are
 * the actions the app tracks so every important change can be explained later:
 * who did it, when, and what changed. The audit trail is write-once evidence,
 * kept for 10 years.
 */
@Getter
public enum AuditAction {
    CREATE("CREATE"),
    UPDATE("UPDATE"),
    DELETE("DELETE"),
    APPROVE("APPROVE"),
    SIGN("SIGN"),
    GENERATE("GENERATE"),
    EXPORT("EXPORT"),
    INVITE("INVITE"),
    ROLE_CHANGE("ROLE_CHANGE"),
    ACTIVATE("ACTIVATE"),
    DEACTIVATE("DEACTIVATE"),
    LOGIN("LOGIN");

    private final String code;

    AuditAction(String code) {
        this.code = code;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    @JsonCreator
    public static AuditAction fromCode(String code) {
        if (code != null) {
            for (AuditAction v : values()) {
                if (v.code.equalsIgnoreCase(code.trim()) || v.name().equalsIgnoreCase(code.trim())) {
                    return v;
                }
            }
        }
        throw new IllegalArgumentException("Unknown audit action: " + code);
    }
}
