package com.safevoice.backend.model.enums.user;

import lombok.Getter;

/**
 * Enterprise user roles for RBAC compliance.
 */
@Getter
public enum AppRole {
    ADMIN("Admin"),
    COMPLIANCE_OFFICER("Compliance Officer"),
    INVESTIGATOR("Investigator"),
    HR_MANAGER("HR Manager"),
    AUDITOR("Auditor");

    private final String label;

    AppRole(String label) {
        this.label = label;
    }
}
