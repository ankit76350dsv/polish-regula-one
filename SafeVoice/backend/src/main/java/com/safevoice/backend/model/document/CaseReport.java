package com.safevoice.backend.model.document;

import com.fasterxml.jackson.annotation.JsonIgnore;
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
@Document(collection = "safevoice_case_reports")
@CompoundIndexes({
    @CompoundIndex(name = "tenant_tracking_idx", def = "{'tenantId': 1, 'trackingCode': 1}", unique = true, sparse = true)
})
public class CaseReport extends BaseDocument {

    @Indexed(sparse = true)
    private String trackingCode;

    // Credential material — NEVER serialize to any API response. @JsonIgnore blocks Jackson
    // (HTTP) output only; Spring Data MongoDB uses its own converter, so these are still
    // persisted and read from the database normally. Exposing even the HASH lets anyone who
    // sees a case payload fingerprint/correlate a reporter's credential (anonymity breach).
    @JsonIgnore
    private String hashedPin;

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

    // True once the case has been escalated for approaching/breaching its 3-month feedback
    // deadline, so the compliance job escalates each case only once.
    private boolean feedbackEscalated = false;
}
