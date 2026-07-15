package com.privacypilot.backend.model.enums.activity;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * The company department that owns a processing activity (who is responsible
 * for it inside the company). Used for filtering the register and for reports.
 * Values mirror the picker shown in the frontend wizard.
 */
@Getter
public enum Department {
    HR("hr", "Kadry (HR)"),
    FINANCE("finance", "Finanse"),
    IT("it", "IT"),
    MARKETING("marketing", "Marketing"),
    SALES("sales", "Sprzedaż"),
    OPERATIONS("operations", "Operacje"),
    LEGAL("legal", "Dział prawny"),
    SECURITY("security", "Ochrona");

    private final String code;
    private final String pl;

    Department(String code, String pl) {
        this.code = code;
        this.pl = pl;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    @JsonCreator
    public static Department fromCode(String code) {
        if (code != null) {
            for (Department v : values()) {
                if (v.code.equalsIgnoreCase(code.trim()) || v.name().equalsIgnoreCase(code.trim())) {
                    return v;
                }
            }
        }
        throw new IllegalArgumentException("Unknown department: " + code);
    }
}
