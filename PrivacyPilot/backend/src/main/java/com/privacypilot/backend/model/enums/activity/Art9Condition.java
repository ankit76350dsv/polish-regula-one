package com.privacypilot.backend.model.enums.activity;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * The extra legal condition needed to use SPECIAL categories of data (very
 * sensitive data like health, religion, trade-union membership). Normal data
 * only needs an Article 6 basis; special data ALSO needs one of these Article
 * 9(2) conditions. The frontend stores just the letter (e.g. "b"), so the code
 * here is that single letter.
 */
@Getter
public enum Art9Condition {
    EXPLICIT_CONSENT("a", "Art. 9(2)(a)", "Explicit consent", "Wyraźna zgoda"),
    EMPLOYMENT_SOCIAL_SECURITY("b", "Art. 9(2)(b)", "Employment / social security law", "Prawo pracy i zabezpieczenia społecznego"),
    VITAL_INTERESTS("c", "Art. 9(2)(c)", "Vital interests (subject incapable of consent)", "Żywotne interesy (brak możliwości zgody)"),
    NONPROFIT_BODY("d", "Art. 9(2)(d)", "Foundation / association / non-profit (members)", "Fundacje, stowarzyszenia (członkowie)"),
    MANIFESTLY_PUBLIC("e", "Art. 9(2)(e)", "Data manifestly made public by the subject", "Dane upublicznione przez osobę"),
    LEGAL_CLAIMS("f", "Art. 9(2)(f)", "Legal claims / courts acting judicially", "Dochodzenie roszczeń / wymiar sprawiedliwości"),
    SUBSTANTIAL_PUBLIC_INTEREST("g", "Art. 9(2)(g)", "Substantial public interest (EU/Member State law)", "Ważny interes publiczny (prawo UE/państwa)"),
    HEALTH_CARE("h", "Art. 9(2)(h)", "Health care / occupational medicine", "Opieka zdrowotna / medycyna pracy"),
    PUBLIC_HEALTH("i", "Art. 9(2)(i)", "Public health", "Zdrowie publiczne"),
    ARCHIVING_RESEARCH("j", "Art. 9(2)(j)", "Archiving / research / statistics (Art. 89(1))", "Archiwizacja / badania naukowe / statystyka");

    private final String code;
    private final String ref;
    private final String en;
    private final String pl;

    Art9Condition(String code, String ref, String en, String pl) {
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
    public static Art9Condition fromCode(String code) {
        if (code != null) {
            for (Art9Condition v : values()) {
                if (v.code.equalsIgnoreCase(code.trim()) || v.name().equalsIgnoreCase(code.trim())) {
                    return v;
                }
            }
        }
        throw new IllegalArgumentException("Unknown Art. 9(2) condition: " + code);
    }
}
