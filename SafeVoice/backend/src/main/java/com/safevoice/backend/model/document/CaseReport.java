package com.safevoice.backend.model.document;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.safevoice.backend.model.base.BaseDocument;
import com.safevoice.backend.model.embedded.*;
import com.safevoice.backend.model.enums.case_report.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Main MongoDB document mapping case reports.
 * Employs UUID primary key (inherited from BaseDocument).
 * Adheres to RODO/GDPR with automated retention policies.
 *
 * ENCRYPTION MODEL: ALL report text — HR grievances (LABOUR_DISPUTE) included — is locked
 * (encrypted) in the reporter's browser BEFORE it ever reaches us and is stored in
 * {@link #encryptedContent}. The server cannot read it; only AWS KMS (to unwrap the key) plus
 * the reader's browser (to unlock the text) can. The plain {@link #description} field is used
 * only under the dev-only local-testing plaintext flag.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "safevoice_case_reports")
public class CaseReport extends BaseDocument {

    // SHA-256 fingerprint (64 hex chars) of the reporter's single 64-char access key.
    // We store ONLY this one-way hash — never the key itself — so even our own data
    // cannot reveal a reporter's credential. This is what keeps the channel anonymous.
    // It is null for HR grievance cases, which are routed to HR and get no access key.
    // @JsonIgnore: this hash is the stored authentication secret; it must never leave the server.
    @JsonIgnore
    @Indexed(sparse = true)
    private String keyHash;

    // A short, human-friendly case label shown to staff, e.g. "SV-2F6968FBB1" (or
    // "HR-..." for HR grievances). This is NOT the primary key — the real _id is a
    // MongoDB ObjectId, generated automatically. This field is just a readable handle.
    @Indexed(sparse = true)
    private String caseReference; 

    @org.springframework.data.annotation.Version
    private Long version; 

    private ReportCategory category; 

    // Plain-text report narrative. Normally stays null — it is used ONLY under the dev-only
    // local-testing plaintext flag. In production every report (HR included) is encrypted.
    private String description; 

    // The report narrative, locked (AES-256-GCM) in the reporter's browser using a one-time data
    // key that AWS KMS wrapped. The server stores it but cannot read it. Set for every report,
    // including HR grievances.
    private EncryptedPayload encryptedContent;

    private Instant incidentDate;

    private String department;

    private List<EvidenceAttachment> attachments = new ArrayList<>();

    private CaseStatus status;

    private CaseSeverity severity; 

    private Instant submissionDate;

    private Instant acknowledgementDue;

    private Instant feedbackDue;

    // When the case was last moved to CLOSED. Drives the reporter's post-close grace window
    // (they may still send a final message for a limited time after closure). Null while the
    // case is open; set each time it is closed; cleared when the case is reopened.
    private Instant closedAt; 

    private String assignedInvestigator;

    private DisclosureMode disclosureMode;

    private IntakeChannel intakeChannel;

    private String lawfulBasis; 

    private String controller;
    private String processor;

    private TechnicalMetadataPolicy technicalMetadataPolicy = new TechnicalMetadataPolicy(); //! what is this??

    private RetentionPolicy retention = new RetentionPolicy(); //! when take these input?

    private List<String> riskFlags = new ArrayList<>(); //! why do we need this?

    private List<TimelineEvent> timeline = new ArrayList<>();

    // True once the case has been escalated for approaching/breaching its 3-month feedback
    // deadline, so the compliance job escalates each case only once.
    private boolean feedbackEscalated = false; //! what is this and why we need this
}
