package com.privacypilot.backend.model.enums.gdpr;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * The kinds of outside parties that RECEIVE the data (Art. 30(1)(d)).
 *
 * Important: a "recipient" is not the same as a "processor". A processor works
 * on the company's behalf under a contract (tracked as a Vendor); a recipient is
 * anyone the data is disclosed to (e.g. tax office, bank, courier). PrivacyPilot
 * keeps the two separate so the register stays legally correct.
 */
@Getter
public enum RecipientCategory {
    PUBLIC_AUTHORITIES("public_authorities", "Public authorities (ZUS, US, UODO)", "Organy publiczne (ZUS, US, UODO)"),
    BANKS("banks", "Banks / payment institutions", "Banki / instytucje płatnicze"),
    IT_PROVIDERS("it_providers", "IT service providers", "Dostawcy usług IT"),
    PAYROLL_BUREAU("payroll_bureau", "Payroll / accounting bureau", "Biuro rachunkowe / kadrowo-płacowe"),
    LEGAL_ADVISORS("legal_advisors", "Legal advisors", "Kancelarie prawne"),
    MEDICAL_PROVIDERS("medical_providers", "Occupational medicine providers", "Medycyna pracy"),
    INSURERS("insurers", "Insurers", "Ubezpieczyciele"),
    COURIERS("couriers", "Postal / courier operators", "Operatorzy pocztowi / kurierzy"),
    GROUP_COMPANIES("group_companies", "Group companies", "Spółki z grupy kapitałowej");

    private final String code;
    private final String en;
    private final String pl;

    RecipientCategory(String code, String en, String pl) {
        this.code = code;
        this.en = en;
        this.pl = pl;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    @JsonCreator
    public static RecipientCategory fromCode(String code) {
        if (code != null) {
            for (RecipientCategory v : values()) {
                if (v.code.equalsIgnoreCase(code.trim()) || v.name().equalsIgnoreCase(code.trim())) {
                    return v;
                }
            }
        }
        throw new IllegalArgumentException("Unknown recipient category: " + code);
    }
}
