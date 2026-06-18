package com.safevoice.backend.model.embedded;

import com.safevoice.backend.model.enums.retention.RetentionState;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Embedded document tracking compliance deadlines and legal holds under GDPR / RODO.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RetentionPolicy {

    private RetentionState state;
    private int retentionYears;
    private Instant deleteAfter;
    private Instant irrelevantPersonalDataDeletionDue;
    private String legalHoldReason;
}
