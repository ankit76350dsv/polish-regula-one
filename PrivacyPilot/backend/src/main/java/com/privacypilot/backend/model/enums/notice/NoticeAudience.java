package com.privacypilot.backend.model.enums.notice;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * Who a privacy notice is written for. Each audience maps to the right GDPR
 * article:
 *  - Art. 13 when data is collected directly from the person (website users,
 *    employees, candidates, contractors).
 *  - Art. 14 when data is collected about them from somewhere else
 *    (whistleblowers). The "art" field records which one applies, because the
 *    two articles require slightly different content.
 */
@Getter
public enum NoticeAudience {
    WEBSITE("website", 13, "Website users", "Użytkownicy strony internetowej"),
    EMPLOYEES("employees", 13, "Employees", "Pracownicy"),
    CANDIDATES("candidates", 13, "Job candidates", "Kandydaci do pracy"),
    CONTRACTORS("contractors", 13, "Contractors", "Kontrahenci"),
    WHISTLEBLOWERS("whistleblowers", 14, "Whistleblowers", "Sygnaliści");

    private final String code;
    // Which GDPR article applies to this audience: 13 or 14.
    private final int art;
    private final String en;
    private final String pl;

    NoticeAudience(String code, int art, String en, String pl) {
        this.code = code;
        this.art = art;
        this.en = en;
        this.pl = pl;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    @JsonCreator
    public static NoticeAudience fromCode(String code) {
        if (code != null) {
            for (NoticeAudience v : values()) {
                if (v.code.equalsIgnoreCase(code.trim()) || v.name().equalsIgnoreCase(code.trim())) {
                    return v;
                }
            }
        }
        throw new IllegalArgumentException("Unknown notice audience: " + code);
    }
}
