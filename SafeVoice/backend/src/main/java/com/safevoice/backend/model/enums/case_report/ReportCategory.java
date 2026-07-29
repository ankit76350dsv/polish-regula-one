package com.safevoice.backend.model.enums.case_report;

import lombok.Getter;

/**
 * Categories of whistleblower reports under EU/Poland compliance scope.
 */
@Getter
public enum ReportCategory {
    CORRUPTION("Corruption"),
    FRAUD("Fraud"),
    PUBLIC_PROCUREMENT("Public Procurement"),
    AML("AML / Terrorist Financing"),
    PRODUCT_SAFETY("Product Safety"),
    ENVIRONMENTAL("Environmental Protection"),
    CONSUMER_PROTECTION("Consumer Protection"),
    DATA_PROTECTION("Privacy / Personal Data"),
    CYBERSECURITY("Network & Information Security"),
    HEALTH_SAFETY("Public Health / Safety"),
    DISCRIMINATION("Discrimination"),
    HARASSMENT("Harassment"),
    LABOUR_DISPUTE("Individual HR Grievance"),
    OTHER("Other");

    private final String label;

    ReportCategory(String label) {
        this.label = label;
    }

    /**
     * Finds the category that matches a human-readable label sent by the public web form
     * (for example "Corruption" or "Individual HR Grievance"). The form sends the label,
     * not the enum name, so we translate it here. Matching ignores upper/lower case and
     * surrounding spaces so small differences do not cause a false rejection.
     *
     * @param label the visible category text submitted by the reporter
     * @return the matching ReportCategory
     * @throws IllegalArgumentException if no category matches (turned into a 400 error)
     */
    public static ReportCategory fromLabel(String label) {
        if (label != null) {
            String cleaned = label.trim();
            for (ReportCategory category : values()) {
                // Accept either the visible label ("Corruption") or the raw enum name ("CORRUPTION").
                if (category.label.equalsIgnoreCase(cleaned) || category.name().equalsIgnoreCase(cleaned)) {
                    return category;
                }
            }
        }
        throw new IllegalArgumentException("Unknown report category: " + label);
    }
}
