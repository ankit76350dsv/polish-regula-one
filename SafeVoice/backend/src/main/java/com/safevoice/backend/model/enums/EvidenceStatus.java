package com.safevoice.backend.model.enums;

import lombok.Getter;

/**
 * Status flags tracking evidence sanitization (metadata stripping)
 * and security scanning (malware scanning).
 */
@Getter
public enum EvidenceStatus {
    METADATA_STRIPPED("Metadata stripped"),
    MALWARE_SCAN_PENDING("Malware scan pending"),
    QUARANTINED("Quarantined"),
    REJECTED("Rejected");

    private final String label;

    EvidenceStatus(String label) {
        this.label = label;
    }
}
