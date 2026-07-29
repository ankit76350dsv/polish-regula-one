package com.privacypilot.backend.model.enums.audit;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * The kind of record an audit entry is about (WHICH thing was changed). Paired
 * with the entity id, this lets an auditor jump from the audit trail straight to
 * the record that changed.
 */
@Getter
public enum AuditEntityType {
    ACTIVITY("activity"),
    DPIA("dpia"),
    VENDOR("vendor"),
    TRANSFER("transfer"),
    BREACH("breach"),
    DSAR("dsar"),
    NOTICE("notice"),
    USER("user"),
    SETTINGS("settings");

    private final String code;

    AuditEntityType(String code) {
        this.code = code;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    @JsonCreator
    public static AuditEntityType fromCode(String code) {
        if (code != null) {
            for (AuditEntityType v : values()) {
                if (v.code.equalsIgnoreCase(code.trim()) || v.name().equalsIgnoreCase(code.trim())) {
                    return v;
                }
            }
        }
        throw new IllegalArgumentException("Unknown audit entity type: " + code);
    }
}
