package com.privacypilot.backend.model.enums.gdpr;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * The legal tool that makes sending data OUTSIDE the EEA allowed (GDPR Chapter
 * V). Every international transfer must name one of these, plus the destination
 * country, so the register can prove the transfer is protected.
 */
@Getter
public enum TransferMechanism {
    ADEQUACY("adequacy", "Art. 45", "Adequacy decision", "Decyzja o adekwatności"),
    SCC("scc", "Art. 46(2)(c)", "Standard Contractual Clauses (2021/914)", "Standardowe klauzule umowne (2021/914)"),
    BCR("bcr", "Art. 47", "Binding Corporate Rules", "Wiążące reguły korporacyjne"),
    DEROGATION("derogation", "Art. 49", "Art. 49 derogation (documented)", "Wyjątek z art. 49 (udokumentowany)");

    private final String code;
    private final String ref;
    private final String en;
    private final String pl;

    TransferMechanism(String code, String ref, String en, String pl) {
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
    public static TransferMechanism fromCode(String code) {
        if (code != null) {
            for (TransferMechanism v : values()) {
                if (v.code.equalsIgnoreCase(code.trim()) || v.name().equalsIgnoreCase(code.trim())) {
                    return v;
                }
            }
        }
        throw new IllegalArgumentException("Unknown transfer mechanism: " + code);
    }
}
