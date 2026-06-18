package com.safevoice.backend.model;

import com.safevoice.backend.model.enums.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Main MongoDB document mapping case reports.
 * Employs UUID primary key (inherited from BaseDocument) and indexing on trackingCode.
 * Adheres to RODO/GDPR with automated retention policies and AES-256-GCM encryption
 * flags on sensitive fields (description, contactVaultRef).
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "case_reports")
public class CaseReport extends BaseDocument {

    @Indexed(unique = true, sparse = true)
    private String trackingCode;

    private ReportCategory category;

    @Encrypted
    private String description;

    private Instant incidentDate;

    private String department;

    private List<EvidenceAttachment> attachments = new ArrayList<>();

    private CaseStatus status;

    private CaseSeverity severity;

    private Instant submissionDate;

    private Instant acknowledgementDue;

    private Instant feedbackDue;

    private String assignedInvestigator;

    private DisclosureMode disclosureMode;

    @Encrypted
    private String contactVaultRef;

    private IntakeChannel intakeChannel;

    private String lawfulBasis;

    private String controller;

    private String processor;

    private int slaHoursRemaining;

    private TechnicalMetadataPolicy technicalMetadataPolicy = new TechnicalMetadataPolicy();

    private RetentionPolicy retention = new RetentionPolicy();

    private List<String> riskFlags = new ArrayList<>();

    private List<TimelineEvent> timeline = new ArrayList<>();
}
