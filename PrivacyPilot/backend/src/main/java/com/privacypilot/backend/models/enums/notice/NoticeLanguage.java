package com.privacypilot.backend.model.enums.notice;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * The language a privacy notice is generated in. Polish is the default for the
 * Polish market; English is offered for international staff and audits.
 */
@Getter
public enum NoticeLanguage {
    PL("pl", "Polski"),
    EN("en", "English");

    private final String code;
    private final String label;

    NoticeLanguage(String code, String label) {
        this.code = code;
        this.label = label;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    @JsonCreator
    public static NoticeLanguage fromCode(String code) {
        if (code != null) {
            for (NoticeLanguage v : values()) {
                if (v.code.equalsIgnoreCase(code.trim()) || v.name().equalsIgnoreCase(code.trim())) {
                    return v;
                }
            }
        }
        throw new IllegalArgumentException("Unknown notice language: " + code);
    }
}
