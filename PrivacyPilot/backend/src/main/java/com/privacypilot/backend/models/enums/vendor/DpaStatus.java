package com.privacypilot.backend.model.enums.vendor;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * The state of the Data Processing Agreement (DPA) with an outside supplier
 * (processor). Article 28 GDPR requires a signed DPA before a processor may
 * handle the company's data.
 *  - SIGNED: the agreement is in place.
 *  - IN_NEGOTIATION: being agreed, not signed yet.
 *  - MISSING: no agreement — a compliance gap to fix.
 */
@Getter
public enum DpaStatus {
    SIGNED("signed"),
    IN_NEGOTIATION("in_negotiation"),
    MISSING("missing");

    private final String code;

    DpaStatus(String code) {
        this.code = code;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    @JsonCreator
    public static DpaStatus fromCode(String code) {
        if (code != null) {
            for (DpaStatus v : values()) {
                if (v.code.equalsIgnoreCase(code.trim()) || v.name().equalsIgnoreCase(code.trim())) {
                    return v;
                }
            }
        }
        throw new IllegalArgumentException("Unknown DPA status: " + code);
    }
}
