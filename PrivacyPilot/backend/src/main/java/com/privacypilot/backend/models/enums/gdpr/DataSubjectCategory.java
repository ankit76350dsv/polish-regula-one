package com.privacypilot.backend.model.enums.gdpr;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * The groups of people whose data is used in an activity (for example
 * employees, customers, or whistleblowers). GDPR calls these "categories of
 * data subjects" and Art. 30(1)(c) requires listing them in the ROPA.
 */
@Getter
public enum DataSubjectCategory {
    EMPLOYEES("employees", "Employees", "Pracownicy"),
    CANDIDATES("candidates", "Job candidates", "Kandydaci do pracy"),
    CONTRACTORS("contractors", "Contractors (B2B)", "Współpracownicy (B2B)"),
    CUSTOMERS("customers", "Customers", "Klienci"),
    SUPPLIERS("suppliers", "Supplier contacts", "Kontakty dostawców"),
    WEBSITE_USERS("website_users", "Website users", "Użytkownicy strony"),
    PATIENTS("patients", "Patients", "Pacjenci"),
    WHISTLEBLOWERS("whistleblowers", "Whistleblowers", "Sygnaliści"),
    VISITORS("visitors", "Visitors (premises)", "Osoby odwiedzające");

    private final String code;
    private final String en;
    private final String pl;

    DataSubjectCategory(String code, String en, String pl) {
        this.code = code;
        this.en = en;
        this.pl = pl;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    @JsonCreator
    public static DataSubjectCategory fromCode(String code) {
        if (code != null) {
            for (DataSubjectCategory v : values()) {
                if (v.code.equalsIgnoreCase(code.trim()) || v.name().equalsIgnoreCase(code.trim())) {
                    return v;
                }
            }
        }
        throw new IllegalArgumentException("Unknown data subject category: " + code);
    }
}
