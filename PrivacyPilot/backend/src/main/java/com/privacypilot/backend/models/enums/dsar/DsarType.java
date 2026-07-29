package com.privacypilot.backend.model.enums.dsar;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * The kind of data-subject rights request (a "DSAR") a person can make under
 * GDPR Chapter III (Articles 15–22). For example asking for a copy of their
 * data, asking to fix it, or asking to delete it.
 */
@Getter
public enum DsarType {
    ACCESS("access", "Art. 15", "Access / copy of data", "Dostęp / kopia danych"),
    RECTIFICATION("rectification", "Art. 16", "Rectification", "Sprostowanie"),
    ERASURE("erasure", "Art. 17", "Erasure", "Usunięcie danych"),
    RESTRICTION("restriction", "Art. 18", "Restriction", "Ograniczenie przetwarzania"),
    PORTABILITY("portability", "Art. 20", "Data portability", "Przenoszenie danych"),
    OBJECTION("objection", "Art. 21", "Objection", "Sprzeciw");

    private final String code;
    private final String ref;
    private final String en;
    private final String pl;

    DsarType(String code, String ref, String en, String pl) {
        this.code = code;
        this.ref = ref;
        this.en = en;
        this.pl = pl;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    @JsonCreator
    public static DsarType fromCode(String code) {
        if (code != null) {
            for (DsarType v : values()) {
                if (v.code.equalsIgnoreCase(code.trim()) || v.name().equalsIgnoreCase(code.trim())) {
                    return v;
                }
            }
        }
        throw new IllegalArgumentException("Unknown DSAR type: " + code);
    }
}
