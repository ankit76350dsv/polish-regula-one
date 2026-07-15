package com.privacypilot.backend.model.enums.user;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * The role a user has inside PrivacyPilot. The role decides what the user is
 * allowed to do (see the RBAC permission matrix). Roles follow the
 * least-privilege rule: for example an AUDITOR can only read and export, never
 * change records, and an EMPLOYEE sees only their own tasks.
 *
 * The code is stored in UPPER_CASE (same as the frontend and the shared
 * RegulaOne roles) so it reads clearly in audit logs.
 */
@Getter
public enum PrivacyRole {
    TENANT_ADMIN("TENANT_ADMIN", "Company Admin", "Administrator firmy"),
    COMPLIANCE_OFFICER("COMPLIANCE_OFFICER", "Compliance Officer", "Specjalista ds. zgodności"),
    DPO("DPO", "DPO (IOD)", "Inspektor Ochrony Danych (IOD)"),
    AUDITOR("AUDITOR", "Auditor", "Audytor"),
    EMPLOYEE("EMPLOYEE", "Employee", "Pracownik");

    private final String code;
    private final String en;
    private final String pl;

    PrivacyRole(String code, String en, String pl) {
        this.code = code;
        this.en = en;
        this.pl = pl;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    @JsonCreator
    public static PrivacyRole fromCode(String code) {
        if (code != null) {
            for (PrivacyRole v : values()) {
                if (v.code.equalsIgnoreCase(code.trim()) || v.name().equalsIgnoreCase(code.trim())) {
                    return v;
                }
            }
        }
        throw new IllegalArgumentException("Unknown role: " + code);
    }
}
