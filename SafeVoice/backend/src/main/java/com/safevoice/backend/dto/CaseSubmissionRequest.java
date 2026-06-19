package com.safevoice.backend.dto;

import com.safevoice.backend.model.enums.case_report.DisclosureMode;
import com.safevoice.backend.model.enums.case_report.IntakeChannel;
import com.safevoice.backend.model.enums.case_report.ReportCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.Instant;

/**
 * Request body for creating/submitting a new compliance case report.
 */
@Data
public class CaseSubmissionRequest {

    @NotNull(message = "Report category is required")
    private ReportCategory category;

    @NotBlank(message = "Description is required")
    private String description;

    private Instant incidentDate;

    private String department;

    @NotNull(message = "Disclosure mode is required")
    private DisclosureMode disclosureMode;

    private String contactVaultRef; // Encrypted contact ref (if not anonymous)

    @NotNull(message = "Intake channel is required")
    private IntakeChannel intakeChannel;
}
