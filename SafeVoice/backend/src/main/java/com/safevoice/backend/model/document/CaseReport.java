package com.safevoice.backend.model.document;

import com.safevoice.backend.model.annotation.Encrypted;
import com.safevoice.backend.model.base.BaseDocument;
import com.safevoice.backend.model.embedded.*;
import com.safevoice.backend.model.enums.case_report.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;

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
@CompoundIndexes({
    @CompoundIndex(name = "tenant_tracking_idx", def = "{'tenantId': 1, 'trackingCode': 1}", unique = true, sparse = true)
})
public class CaseReport extends BaseDocument {

    @Indexed(sparse = true)
    private String trackingCode;

    private String hashedPin;

    @org.springframework.data.annotation.Version
    private Long version;

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
