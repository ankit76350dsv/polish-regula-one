package com.privacypilot.backend.model.enums.export;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.privacypilot.backend.model.enums.audit.AuditEntityType;
import lombok.Getter;

/**
 * WHAT was taken out of the app when someone exports, prints or copies something.
 *
 * Why this exists: taking data out of the system is one of the most important things
 * to be able to prove later — an auditor or the UODO can ask "who took a copy of the
 * whole register, and when?". Each value below says which kind of record the copy was
 * about, so the audit line points at the right place.
 *
 * Two shapes of export:
 *   - WHOLE-LIST copies (the register, the audit trail) → there is no single record id,
 *     so {@link #requiresEntityId()} is false and the audit line stores counts + filters.
 *   - SINGLE-DOCUMENT copies (one privacy notice, one breach report) → an id IS required,
 *     and the server checks that record really belongs to the caller's company before
 *     writing the audit line, so the trail can never claim something that did not happen.
 */
@Getter
public enum ExportTarget {

    /** The controller register, Art. 30(1) — the whole list, as filtered on screen. */
    REGISTER_CONTROLLER("register_controller", AuditEntityType.REGISTER,
            "ROPA register (controller, Art. 30(1))", false),

    /** The processor register, Art. 30(2) — the whole list, as filtered on screen. */
    REGISTER_PROCESSOR("register_processor", AuditEntityType.REGISTER,
            "ROPA register (processor, Art. 30(2))", false),

    /** The audit trail itself — the most sensitive copy of all. */
    AUDIT_TRAIL("audit_trail", AuditEntityType.AUDIT_TRAIL,
            "Audit trail", false),

    /** One version of one privacy notice, Art. 13/14. */
    PRIVACY_NOTICE("privacy_notice", AuditEntityType.NOTICE,
            "Privacy notice", true),

    /** One breach notification report, Art. 33(3) — the document sent to UODO. */
    BREACH_REPORT("breach_report", AuditEntityType.BREACH,
            "Breach notification report (Art. 33(3))", true);

    private final String code;
    // Which kind of record the audit line is about, so the trail stays searchable.
    private final AuditEntityType entityType;
    // A readable name for the audit line, e.g. "ROPA register (controller, Art. 30(1))".
    private final String label;
    // True when this export is about ONE record, so an id must be supplied and checked.
    private final boolean requiresEntityId;

    ExportTarget(String code, AuditEntityType entityType, String label, boolean requiresEntityId) {
        this.code = code;
        this.entityType = entityType;
        this.label = label;
        this.requiresEntityId = requiresEntityId;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    /**
     * True when this export is about ONE record, so the caller must say which one and the
     * server must check it belongs to them. Reads better than Lombok's generated
     * {@code isRequiresEntityId()}.
     */
    public boolean requiresEntityId() {
        return requiresEntityId;
    }

    @JsonCreator
    public static ExportTarget fromCode(String code) {
        if (code != null) {
            for (ExportTarget v : values()) {
                if (v.code.equalsIgnoreCase(code.trim()) || v.name().equalsIgnoreCase(code.trim())) {
                    return v;
                }
            }
        }
        throw new IllegalArgumentException("Unknown export target: " + code);
    }
}
