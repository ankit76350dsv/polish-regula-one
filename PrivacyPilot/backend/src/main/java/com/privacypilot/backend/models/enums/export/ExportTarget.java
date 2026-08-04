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

    /**
     * The register of impact assessments, Art. 35 — the whole list.
     *
     * A supervisory authority may ask to see which processing was assessed and what the
     * outcome was, so the list is an evidence document in its own right, separate from the
     * individual assessments below.
     */
    REGISTER_DPIA("register_dpia", AuditEntityType.DPIA,
            "DPIA register (Art. 35)", false),

    /** The register of processors we use, Art. 28 / Art. 30(1)(d) — the whole list. */
    REGISTER_VENDORS("register_vendors", AuditEntityType.VENDOR,
            "Processor register (Art. 28)", false),

    /** The register of transfers out of the EEA, Chapter V / Art. 30(1)(e) — the whole list. */
    REGISTER_TRANSFERS("register_transfers", AuditEntityType.TRANSFER,
            "Transfer register (Chapter V)", false),

    /**
     * The breach register, Art. 33(5) — the whole list.
     *
     * Art. 33(5) obliges the controller to document EVERY breach and to make that
     * documentation available to the supervisory authority on request, so being able to
     * hand the whole register over is a direct legal requirement, not a convenience.
     */
    REGISTER_BREACHES("register_breaches", AuditEntityType.BREACH,
            "Breach register (Art. 33(5))", false),

    /**
     * The register of data subject requests, Arts. 12 and 15–22 — the whole list.
     *
     * This is how a company shows it answered people within the one-month deadline.
     * It contains the requesters' names, so it is one of the most sensitive exports here.
     */
    REGISTER_DSAR("register_dsar", AuditEntityType.DSAR,
            "Data subject request register (Arts. 12, 15-22)", false),

    /** The list of people who can see this company's data, Art. 32 — the whole list. */
    REGISTER_USERS("register_users", AuditEntityType.USER,
            "User access register (Art. 32)", false),

    /** One version of one privacy notice, Art. 13/14. */
    PRIVACY_NOTICE("privacy_notice", AuditEntityType.NOTICE,
            "Privacy notice", true),

    /** One breach notification report, Art. 33(3) — the document sent to UODO. */
    BREACH_REPORT("breach_report", AuditEntityType.BREACH,
            "Breach notification report (Art. 33(3))", true),

    /** One completed impact assessment, Art. 35(7)(a)-(d) — the assessment document. */
    DPIA_REPORT("dpia_report", AuditEntityType.DPIA,
            "DPIA report (Art. 35(7))", true),

    /**
     * The case file for ONE data subject request — the record of how it was handled.
     *
     * Careful: this document is about an identified person, so the export line is the
     * strongest reason of all to record who took a copy.
     */
    DSAR_CASE_FILE("dsar_case_file", AuditEntityType.DSAR,
            "Data subject request case file (Art. 12(3))", true),

    /** One processing activity's full Art. 30 record, as a single record sheet. */
    ACTIVITY_RECORD("activity_record", AuditEntityType.ACTIVITY,
            "Processing activity record (Art. 30)", true);

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
