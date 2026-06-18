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
}
