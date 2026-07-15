package com.privacypilot.backend.model.enums.gdpr;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * "TOMs" = Technical and Organisational Measures (Art. 32 GDPR) — the safeguards
 * a company uses to keep data safe, such as encryption, access control, and
 * staff training. Each activity lists which ones it uses, so the register shows
 * that appropriate security is in place.
 */
@Getter
public enum Tom {
    ENCRYPTION_REST("tom_encryption_rest", "Encryption at rest (AES-256)", "Szyfrowanie danych w spoczynku (AES-256)"),
    ENCRYPTION_TRANSIT("tom_encryption_transit", "Encryption in transit (TLS 1.3)", "Szyfrowanie transmisji (TLS 1.3)"),
    PSEUDONYMISATION("tom_pseudonymisation", "Pseudonymisation", "Pseudonimizacja"),
    ACCESS_CONTROL("tom_access_control", "Role-based access control", "Kontrola dostępu oparta na rolach"),
    MFA("tom_mfa", "Multi-factor authentication", "Uwierzytelnianie wieloskładnikowe"),
    BACKUPS("tom_backups", "Regular encrypted backups", "Regularne szyfrowane kopie zapasowe"),
    LOGGING("tom_logging", "Access logging and monitoring", "Rejestrowanie i monitorowanie dostępu"),
    DPA_CONTRACTS("tom_dpa_contracts", "Signed DPAs with all processors (Art. 28)", "Umowy powierzenia ze wszystkimi podmiotami (art. 28)"),
    TRAINING("tom_training", "Staff data-protection training", "Szkolenia pracowników z ochrony danych"),
    CLEAN_DESK("tom_clean_desk", "Clean desk / physical security policy", "Polityka czystego biurka / ochrona fizyczna"),
    INCIDENT_PROCEDURE("tom_incident_procedure", "Incident response procedure", "Procedura reagowania na incydenty"),
    RETENTION_AUTOMATION("tom_retention_automation", "Automated retention enforcement", "Automatyczne egzekwowanie retencji"),
    VULNERABILITY("tom_vulnerability", "Vulnerability management / pentesting", "Zarządzanie podatnościami / testy penetracyjne"),
    ANONYMISATION("tom_anonymisation", "Anonymisation of analytics data", "Anonimizacja danych analitycznych");

    private final String code;
    private final String en;
    private final String pl;

    Tom(String code, String en, String pl) {
        this.code = code;
        this.en = en;
        this.pl = pl;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    @JsonCreator
    public static Tom fromCode(String code) {
        if (code != null) {
            for (Tom v : values()) {
                if (v.code.equalsIgnoreCase(code.trim()) || v.name().equalsIgnoreCase(code.trim())) {
                    return v;
                }
            }
        }
        throw new IllegalArgumentException("Unknown technical/organisational measure: " + code);
    }
}
