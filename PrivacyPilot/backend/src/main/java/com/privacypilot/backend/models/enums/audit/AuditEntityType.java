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
    SETTINGS("settings"),
    // The next two are WHOLE-COLLECTION things rather than one record, so an audit
    // entry about them has no single entity id. They exist because taking a COPY of
    // the whole register or the whole trail is itself an event we must record
    // (GDPR Art. 5(2) accountability) — see ExportService.
    REGISTER("register"),
    AUDIT_TRAIL("audit_trail");

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
