package com.privacypilot.backend.model.enums.dpia;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * The 12 processing types from the Polish mandatory-DPIA list
 * (Komunikat Prezesa UODO z 17 czerwca 2019 r., M.P. 2019 poz. 666, issued
 * under Art. 35(4) GDPR and built on the EDPB WP248 criteria).
 *
 * When an activity matches these, PrivacyPilot decides whether a DPIA is
 * required. Each value keeps its exact legal reference so the assessment can
 * cite the source, which auditors expect.
 */
@Getter
public enum DpiaCriterion {
    EVALUATION_SCORING("evaluation_scoring", "M.P. 2019 poz. 666, pkt 1",
            "Evaluation or scoring, including profiling and predicting"),
    AUTOMATED_DECISIONS("automated_decisions", "M.P. 2019 poz. 666, pkt 2",
            "Automated decision-making with legal or similarly significant effect"),
    SYSTEMATIC_MONITORING("systematic_monitoring", "M.P. 2019 poz. 666, pkt 3",
            "Systematic large-scale monitoring of public places or of employees"),
    SPECIAL_CATEGORIES("special_categories", "M.P. 2019 poz. 666, pkt 4",
            "Special categories (Art. 9) or criminal data (Art. 10)"),
    BIOMETRIC("biometric", "M.P. 2019 poz. 666, pkt 5",
            "Biometric data solely to identify a person or control access"),
    GENETIC("genetic", "M.P. 2019 poz. 666, pkt 6",
            "Genetic data"),
    LARGE_SCALE("large_scale", "M.P. 2019 poz. 666, pkt 7",
            "Large-scale processing (subjects, volume, duration, geography)"),
    MATCHING_COMBINING("matching_combining", "M.P. 2019 poz. 666, pkt 8",
            "Matching or combining datasets from different sources"),
    VULNERABLE_SUBJECTS("vulnerable_subjects", "M.P. 2019 poz. 666, pkt 9",
            "Data of vulnerable/dependent persons (employees, children, patients)"),
    INNOVATIVE_TECH("innovative_tech", "M.P. 2019 poz. 666, pkt 10",
            "Innovative technological or organisational solutions"),
    BLOCKS_RIGHTS("blocks_rights", "M.P. 2019 poz. 666, pkt 11",
            "Processing that prevents exercising rights or using a service/contract"),
    LOCATION_TRACKING("location_tracking", "M.P. 2019 poz. 666, pkt 12",
            "Processing of location data (incl. employee location tracking)");

    private final String code;
    private final String ref;
    private final String en;

    DpiaCriterion(String code, String ref, String en) {
        this.code = code;
        this.ref = ref;
        this.en = en;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    @JsonCreator
    public static DpiaCriterion fromCode(String code) {
        if (code != null) {
            for (DpiaCriterion v : values()) {
                if (v.code.equalsIgnoreCase(code.trim()) || v.name().equalsIgnoreCase(code.trim())) {
                    return v;
                }
            }
        }
        throw new IllegalArgumentException("Unknown DPIA criterion: " + code);
    }
}
