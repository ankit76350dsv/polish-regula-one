package com.safevoice.backend.dto;

import com.safevoice.backend.model.enums.case_report.DisclosureMode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Response DTO returned to the whistleblower upon successful case submission.
 * Contains the generated tracking code and access PIN.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CaseSubmissionResponse {

    private String id;

    private String trackingCode;

    private String pin; // Plaintext PIN shown once to the reporter (null for LABOUR_DISPUTE)

    private DisclosureMode disclosureMode;

    private Instant submissionDate;

    private Instant acknowledgementDue;

    private Instant feedbackDue;
}
