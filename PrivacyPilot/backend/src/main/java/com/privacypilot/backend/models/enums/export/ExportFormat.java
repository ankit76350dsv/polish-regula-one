package com.privacypilot.backend.model.enums.export;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * HOW the data left the app. Recorded on the audit line next to the {@link ExportTarget}.
 *
 * Printing and copying to the clipboard are listed here on purpose: they take the data
 * out of the system exactly as effectively as a file download does, so for accountability
 * they are exports too. For the UODO breach report, "copy" is in fact the MAIN way the
 * document leaves — the officer pastes it into the official form on biznes.gov.pl.
 */
@Getter
public enum ExportFormat {
    CSV("csv"),
    JSON("json"),
    MARKDOWN("markdown"),
    WORD("word"),
    /** Opened in a print window (the usual route to a PDF). */
    PRINT("print"),
    /** Copied to the clipboard. */
    CLIPBOARD("clipboard");

    private final String code;

    ExportFormat(String code) {
        this.code = code;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    @JsonCreator
    public static ExportFormat fromCode(String code) {
        if (code != null) {
            for (ExportFormat v : values()) {
                if (v.code.equalsIgnoreCase(code.trim()) || v.name().equalsIgnoreCase(code.trim())) {
                    return v;
                }
            }
        }
        throw new IllegalArgumentException("Unknown export format: " + code);
    }
}
