package com.privacypilot.backend.model.enums.dpia;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * The result of screening an activity against the Polish UODO mandatory-DPIA
 * list (M.P. 2019 poz. 666, under Art. 35 GDPR):
 *  - REQUIRED: a DPIA must be done before processing starts.
 *  - RECOMMENDED: one criterion matched — assess and document the decision.
 *  - NOT_INDICATED: no criteria matched — a DPIA is not needed for now.
 */
@Getter
public enum DpiaVerdict {
    REQUIRED("required"),
    RECOMMENDED("recommended"),
    NOT_INDICATED("not_indicated");

    private final String code;

    DpiaVerdict(String code) {
        this.code = code;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    @JsonCreator
    public static DpiaVerdict fromCode(String code) {
        if (code != null) {
            for (DpiaVerdict v : values()) {
                if (v.code.equalsIgnoreCase(code.trim()) || v.name().equalsIgnoreCase(code.trim())) {
                    return v;
                }
            }
        }
        throw new IllegalArgumentException("Unknown DPIA verdict: " + code);
    }
}
