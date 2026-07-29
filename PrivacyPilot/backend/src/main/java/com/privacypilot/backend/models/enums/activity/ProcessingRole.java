package com.privacypilot.backend.model.enums.activity;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * Whether the company is the CONTROLLER (decides why and how data is used) or a
 * PROCESSOR (only handles data on behalf of another controller). GDPR treats the
 * two very differently, so every processing activity must say which one it is.
 * Art. 4(7) (controller) and Art. 4(8) (processor) GDPR.
 */
@Getter
public enum ProcessingRole {
    CONTROLLER("controller", "Administrator (Art. 4(7))"),
    PROCESSOR("processor", "Podmiot przetwarzający (Art. 4(8))");

    private final String code;
    private final String pl;

    ProcessingRole(String code, String pl) {
        this.code = code;
        this.pl = pl;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    @JsonCreator
    public static ProcessingRole fromCode(String code) {
        if (code != null) {
            for (ProcessingRole v : values()) {
                if (v.code.equalsIgnoreCase(code.trim()) || v.name().equalsIgnoreCase(code.trim())) {
                    return v;
                }
            }
        }
        throw new IllegalArgumentException("Unknown processing role: " + code);
    }
}
