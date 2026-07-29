package com.privacypilot.backend.model.enums.activity;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * The legal reason a company is allowed to use personal data — all SIX bases
 * from Article 6(1) GDPR. Every controller activity must pick exactly one.
 *
 * We keep the official article reference on each value so reports and the ROPA
 * export can print the exact legal basis, which auditors expect to see.
 */
@Getter
public enum LawfulBasis {
    CONSENT("consent", "Art. 6(1)(a)", "Consent", "Zgoda osoby, której dane dotyczą"),
    CONTRACT("contract", "Art. 6(1)(b)", "Performance of a contract", "Wykonanie umowy"),
    LEGAL_OBLIGATION("legal_obligation", "Art. 6(1)(c)", "Legal obligation", "Obowiązek prawny administratora"),
    VITAL_INTERESTS("vital_interests", "Art. 6(1)(d)", "Vital interests", "Ochrona żywotnych interesów"),
    PUBLIC_TASK("public_task", "Art. 6(1)(e)", "Public interest / official task", "Zadanie realizowane w interesie publicznym"),
    LEGITIMATE_INTEREST("legitimate_interest", "Art. 6(1)(f)", "Legitimate interests", "Prawnie uzasadniony interes administratora");

    private final String code;
    private final String ref;
    private final String en;
    private final String pl;

    LawfulBasis(String code, String ref, String en, String pl) {
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
    public static LawfulBasis fromCode(String code) {
        if (code != null) {
            for (LawfulBasis v : values()) {
                if (v.code.equalsIgnoreCase(code.trim()) || v.name().equalsIgnoreCase(code.trim())) {
                    return v;
                }
            }
        }
        throw new IllegalArgumentException("Unknown lawful basis: " + code);
    }
}
