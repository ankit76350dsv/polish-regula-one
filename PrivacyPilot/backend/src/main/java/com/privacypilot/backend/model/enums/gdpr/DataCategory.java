package com.privacypilot.backend.model.enums.gdpr;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * The kinds of personal data a processing activity can touch.
 *
 * Some kinds are extra-sensitive and get special treatment in the law:
 *  - "special" = Article 9 special-category data (health, religion, etc.). Using
 *    it needs an extra Art. 9(2) condition.
 *  - "art10" = data about criminal convictions/offences (Article 10).
 * These two flags let the DPIA screening and notice generator react correctly
 * without hard-coding a second list somewhere else.
 */
@Getter
public enum DataCategory {
    IDENTITY("identity", "Identification data (name, PESEL, ID no.)", false, false),
    CONTACT("contact", "Contact details (email, phone, address)", false, false),
    FINANCIAL("financial", "Financial data (salary, bank account)", false, false),
    EMPLOYMENT("employment", "Employment data (contract, evaluations)", false, false),
    IMAGE_CCTV("image_cctv", "Image / CCTV footage", false, false),
    LOCATION("location", "Location data", false, false),
    ONLINE_IDENTIFIERS("online_identifiers", "Online identifiers (IP, cookies)", false, false),
    CHILDREN("children", "Children's data (Art. 8)", false, false),
    // Article 9(1) special categories — the sensitive ones.
    HEALTH("health", "Health data (Art. 9)", true, false),
    BIOMETRIC_ID("biometric_id", "Biometric data for identification (Art. 9)", true, false),
    GENETIC("genetic", "Genetic data (Art. 9)", true, false),
    RACIAL_ETHNIC("racial_ethnic", "Racial or ethnic origin (Art. 9)", true, false),
    POLITICAL("political", "Political opinions (Art. 9)", true, false),
    RELIGIOUS("religious", "Religious or philosophical beliefs (Art. 9)", true, false),
    TRADE_UNION("trade_union", "Trade union membership (Art. 9)", true, false),
    SEX_LIFE("sex_life", "Data concerning sex life (Art. 9)", true, false),
    SEXUAL_ORIENTATION("sexual_orientation", "Sexual orientation (Art. 9)", true, false),
    // Article 10 criminal data.
    CRIMINAL("criminal", "Criminal convictions / offences (Art. 10)", false, true);

    private final String code;
    private final String en;
    // True if this is an Article 9 special category (needs an Art. 9(2) condition).
    private final boolean special;
    // True if this is Article 10 criminal-offence data.
    private final boolean art10;

    DataCategory(String code, String en, boolean special, boolean art10) {
        this.code = code;
        this.en = en;
        this.special = special;
        this.art10 = art10;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    @JsonCreator
    public static DataCategory fromCode(String code) {
        if (code != null) {
            for (DataCategory v : values()) {
                if (v.code.equalsIgnoreCase(code.trim()) || v.name().equalsIgnoreCase(code.trim())) {
                    return v;
                }
            }
        }
        throw new IllegalArgumentException("Unknown data category: " + code);
    }
}
