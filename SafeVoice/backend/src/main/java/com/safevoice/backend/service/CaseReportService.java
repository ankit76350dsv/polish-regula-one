package com.safevoice.backend.service;

import com.safevoice.backend.dto.CaseSubmissionRequest;
import com.safevoice.backend.dto.CaseSubmissionResponse;
import com.safevoice.backend.model.document.CaseReport;
import com.safevoice.backend.model.embedded.TimelineEvent;
import com.safevoice.backend.model.enums.audit.AuditActionType;
import com.safevoice.backend.model.enums.audit.AuditOutcome;
import com.safevoice.backend.model.enums.case_report.CaseSeverity;
import com.safevoice.backend.model.enums.case_report.CaseStatus;
import com.safevoice.backend.model.enums.case_report.DisclosureMode;
import com.safevoice.backend.model.enums.case_report.ReportCategory;
import com.safevoice.backend.repository.CaseReportRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Service orchestrating operations on CaseReport documents.
 */
@Service
public class CaseReportService {

    private final CaseReportRepository caseReportRepository;
    private final AuditLogService auditLogService;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private final SecureRandom secureRandom = new SecureRandom();

    @Autowired
    public CaseReportService(CaseReportRepository caseReportRepository, AuditLogService auditLogService) {
        this.caseReportRepository = caseReportRepository;
        this.auditLogService = auditLogService;
    }

    /**
     * Submit a new case report. Handles tracking code and PIN generation,
     * compliance deadlines, dynamic labour dispute flows, and audit logs.
     */
    public CaseSubmissionResponse submit(CaseSubmissionRequest request, String tenantId) {
        if (tenantId == null || tenantId.trim().isEmpty()) {
            throw new IllegalArgumentException("Tenant context (X-Tenant-ID) is required");
        }

        Instant now = Instant.now();
        String trackingCode = generateTrackingCode();
        String plaintextPin = null;
        String hashedPin = null;

        // Apply labour dispute compliance rule
        DisclosureMode disclosureMode = request.getDisclosureMode();
        if (request.getCategory() == ReportCategory.LABOUR_DISPUTE) {
            disclosureMode = DisclosureMode.HR_HANDOFF;
        } else {
            // Generate numeric PIN for standard anonymous access retrieval
            plaintextPin = generateNumericPin();
            hashedPin = encoder.encode(plaintextPin);
        }

        CaseReport caseReport = new CaseReport();
        caseReport.setTenantId(tenantId);
        caseReport.setTrackingCode(trackingCode);
        caseReport.setCategory(request.getCategory());
        caseReport.setDescription(request.getDescription());
        caseReport.setIncidentDate(request.getIncidentDate());
        caseReport.setDepartment(request.getDepartment());
        caseReport.setDisclosureMode(disclosureMode);
        caseReport.setContactVaultRef(request.getContactVaultRef());
        caseReport.setIntakeChannel(request.getIntakeChannel());
        caseReport.setStatus(CaseStatus.RECEIVED);
        caseReport.setSeverity(CaseSeverity.MEDIUM);
        caseReport.setSubmissionDate(now);

        // Compliance SLAs: 7-day acknowledgement, 90-day feedback deadline
        caseReport.setAcknowledgementDue(now.plus(7, ChronoUnit.DAYS));
        caseReport.setFeedbackDue(now.plus(90, ChronoUnit.DAYS));

        // Setup timeline
        List<TimelineEvent> timeline = new ArrayList<>();
        timeline.add(new TimelineEvent(
                UUID.randomUUID(),
                "Report Submitted",
                "Case intake completed via " + request.getIntakeChannel().name(),
                now,
                "system"
        ));
        caseReport.setTimeline(timeline);

        CaseReport saved = caseReportRepository.save(caseReport);

        // Record compliance audit log
        auditLogService.log(
                tenantId,
                "Public Portal",
                "Anonymous Whistleblower",
                AuditActionType.REPORT_RECEIVED,
                saved.getId(),
                AuditOutcome.RECORDED,
                null,
                "Report category: " + saved.getCategory().name(),
                "Metadata stripped automatically on intake."
        );

        return CaseSubmissionResponse.builder()
                .id(saved.getId())
                .trackingCode(trackingCode)
                .pin(plaintextPin) // Only present for standard cases (null for LABOUR_DISPUTE)
                .disclosureMode(disclosureMode)
                .submissionDate(now)
                .acknowledgementDue(caseReport.getAcknowledgementDue())
                .feedbackDue(caseReport.getFeedbackDue())
                .build();
    }

    /**
     * Retrieve a case report. Verifies PIN code if required.
     */
    public CaseReport retrieve(String trackingCode, String pin, String tenantId) {
        if (tenantId == null || tenantId.trim().isEmpty()) {
            throw new IllegalArgumentException("Tenant context is required");
        }

        CaseReport report = caseReportRepository.findByTenantIdAndTrackingCode(tenantId, trackingCode)
                .orElseThrow(() -> new IllegalArgumentException("Invalid tracking code or tenant ID"));

        // If not a labour dispute, enforce PIN verification
        if (report.getCategory() != ReportCategory.LABOUR_DISPUTE) {
            if (pin == null || pin.isBlank() || report.getHashedPin() == null ||
                    !encoder.matches(pin, report.getHashedPin())) {
                auditLogService.log(
                        tenantId,
                        "Public Portal",
                        "Anonymous Whistleblower",
                        AuditActionType.ACCESS_REVIEW,
                        report.getId(),
                        AuditOutcome.DENIED,
                        null,
                        "Failed tracking PIN access attempt",
                        "Access Denied: Invalid PIN code."
                );
                throw new IllegalArgumentException("Invalid tracking code or PIN code");
            }
        }

        return report;
    }

    /**
     * Internal lookup by ID.
     */
    public CaseReport getById(UUID id, String tenantId) {
        return caseReportRepository.findById(id)
                .filter(r -> r.getTenantId().equals(tenantId) && !r.isDeleted())
                .orElseThrow(() -> new IllegalArgumentException("Case report not found"));
    }

    /**
     * Lists active cases for a tenant.
     */
    public List<CaseReport> list(String tenantId) {
        return caseReportRepository.findAllByTenantIdAndDeletedFalse(tenantId);
    }

    /**
     * Update Case status.
     */
    public CaseReport updateStatus(UUID caseId, CaseStatus newStatus, String tenantId, String actorRole, String actorId) {
        CaseReport report = getById(caseId, tenantId);
        CaseStatus oldStatus = report.getStatus();
        if (oldStatus == newStatus) {
            return report;
        }

        report.setStatus(newStatus);
        report.getTimeline().add(new TimelineEvent(
                UUID.randomUUID(),
                "Status Changed",
                "Case status updated from " + oldStatus + " to " + newStatus,
                Instant.now(),
                "status"
        ));

        CaseReport saved = caseReportRepository.save(report);

        auditLogService.log(
                tenantId,
                actorRole,
                actorId,
                AuditActionType.CASE_STATUS_CHANGED,
                caseId,
                AuditOutcome.RECORDED,
                oldStatus.name(),
                newStatus.name(),
                "Status updated by investigator."
        );

        return saved;
    }

    /**
     * Update Case severity.
     */
    public CaseReport updateSeverity(UUID caseId, CaseSeverity newSeverity, String tenantId, String actorRole, String actorId) {
        CaseReport report = getById(caseId, tenantId);
        CaseSeverity oldSeverity = report.getSeverity();
        if (oldSeverity == newSeverity) {
            return report;
        }

        report.setSeverity(newSeverity);
        report.getTimeline().add(new TimelineEvent(
                UUID.randomUUID(),
                "Severity Changed",
                "Case severity updated from " + oldSeverity + " to " + newSeverity,
                Instant.now(),
                "system"
        ));

        CaseReport saved = caseReportRepository.save(report);

        auditLogService.log(
                tenantId,
                actorRole,
                actorId,
                AuditActionType.SEVERITY_CHANGED,
                caseId,
                AuditOutcome.RECORDED,
                oldSeverity.name(),
                newSeverity.name(),
                "Severity re-assessed."
        );

        return saved;
    }

    /**
     * Assign investigator.
     */
    public CaseReport assignInvestigator(UUID caseId, String investigator, String tenantId, String actorRole, String actorId) {
        CaseReport report = getById(caseId, tenantId);
        String oldInvestigator = report.getAssignedInvestigator();

        report.setAssignedInvestigator(investigator);
        report.getTimeline().add(new TimelineEvent(
                UUID.randomUUID(),
                "Investigator Assigned",
                "Case assigned to investigator: " + investigator,
                Instant.now(),
                "system"
        ));

        CaseReport saved = caseReportRepository.save(report);

        auditLogService.log(
                tenantId,
                actorRole,
                actorId,
                AuditActionType.INVESTIGATOR_ASSIGNED,
                caseId,
                AuditOutcome.RECORDED,
                oldInvestigator,
                investigator,
                "Case investigator assignment updated."
        );

        return saved;
    }

    /**
     * Helper to add file attachments to CaseReport.
     */
    public CaseReport addAttachment(UUID caseId, com.safevoice.backend.model.embedded.EvidenceAttachment attachment, String tenantId) {
        CaseReport report = getById(caseId, tenantId);
        report.getAttachments().add(attachment);
        report.getTimeline().add(new TimelineEvent(
                UUID.randomUUID(),
                "Evidence Attachment Uploaded",
                "File " + attachment.getDisplayName() + " successfully attached.",
                Instant.now(),
                "attachment"
        ));

        CaseReport saved = caseReportRepository.save(report);

        auditLogService.log(
                tenantId,
                "Public Portal",
                "Anonymous Whistleblower",
                AuditActionType.EVIDENCE_ADDED,
                caseId,
                AuditOutcome.RECORDED,
                null,
                attachment.getId().toString(),
                "New evidence file hash verified: " + attachment.getSha256Checksum()
        );

        return saved;
    }

    private String generateTrackingCode() {
        // Generates a 12-character uppercase alphanumeric tracking code (A-Z, 0-9)
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        StringBuilder sb = new StringBuilder(12);
        for (int i = 0; i < 12; i++) {
            sb.append(chars.charAt(secureRandom.nextInt(chars.length())));
        }
        return sb.toString();
    }

    private String generateNumericPin() {
        // Generates an 8-digit numeric access PIN
        StringBuilder sb = new StringBuilder(8);
        for (int i = 0; i < 8; i++) {
            sb.append(secureRandom.nextInt(10));
        }
        return sb.toString();
    }
}
