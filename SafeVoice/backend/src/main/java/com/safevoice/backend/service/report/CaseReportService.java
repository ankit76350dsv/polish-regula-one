package com.safevoice.backend.service.report;

import com.safevoice.backend.dto.CaseSubmissionRequest;
import com.safevoice.backend.dto.CaseSubmissionResponse;
import com.safevoice.backend.exception.CaseNotFoundException;
import com.safevoice.backend.exception.CaseReferenceConflictException;
import com.safevoice.backend.exception.TenantNotFoundException;
import com.safevoice.backend.model.document.CaseReport;
import com.safevoice.backend.model.document.Tenant;
import com.safevoice.backend.model.embedded.EvidenceAttachment;
import com.safevoice.backend.model.embedded.TimelineEvent;
import com.safevoice.backend.model.enums.audit.AuditActionType;
import com.safevoice.backend.model.enums.audit.AuditOutcome;
import com.safevoice.backend.model.enums.case_report.CaseSeverity;
import com.safevoice.backend.model.enums.case_report.CaseStatus;
import com.safevoice.backend.model.enums.case_report.DisclosureMode;
import com.safevoice.backend.model.enums.case_report.IntakeChannel;
import com.safevoice.backend.model.enums.case_report.ReportCategory;
import com.safevoice.backend.repository.CaseReportRepository;
import com.safevoice.backend.repository.TenantRepository;
import com.safevoice.backend.service.AuditLogService;
import com.safevoice.backend.service.report.utils.CaseReportUtils;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * Service orchestrating operations on CaseReport documents.
 */
@Service
public class CaseReportService {

    private final CaseReportRepository caseReportRepository;
    private final TenantRepository tenantRepository;
    private final AuditLogService auditLogService;

    @Autowired
    public CaseReportService(CaseReportRepository caseReportRepository,
                             TenantRepository tenantRepository,
                             AuditLogService auditLogService) {
        this.caseReportRepository = caseReportRepository;
        this.tenantRepository = tenantRepository;
        this.auditLogService = auditLogService;
    }

    /**
     * Submit a new whistleblower report.
     *
     * What happens here, in plain steps:
     *  1. Work out the category (from the label the form sent) and whether this is an
     *     HR grievance — HR grievances are routed to HR and get NO anonymous key.
     *  2. For a normal report, make ONE 64-character access key, hash it, and use the
     *     hash to derive a short, non-secret case reference (the case's id) for staff.
     *  3. Save the case with its compliance deadlines, timeline, and evidence metadata.
     *  4. Write an immutable audit log entry (with no reporter-identifying data).
     *  5. Return the plain access key to show the reporter ONCE (never stored).
     */
    public CaseSubmissionResponse submit(CaseSubmissionRequest request) {
        // The organisation the report is for. It is required and MUST already exist in
        // the tenant registry — we never accept a report for an unknown organisation.
        if (request.getTenantId() == null || request.getTenantId().isBlank()) {
            throw new IllegalArgumentException("Tenant info/context is required");
        }
        String tenantId = request.getTenantId().trim();
        // Look the organisation up in the shared "tenants" collection and make sure it is
        // present and ACTIVE. We never accept a report for an unknown or switched-off tenant.
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new TenantNotFoundException("Unknown tenant: " + tenantId));
        if (!"ACTIVE".equalsIgnoreCase(tenant.getStatus())) {
            throw new TenantNotFoundException("Tenant is not active: " + tenantId);
        }

        Instant now = Instant.now();

        // Translate the visible category label (e.g. "Fraud") into our strong enum type.
        ReportCategory category = ReportCategory.fromLabel(request.getCategory());
        boolean isHrOnly = category == ReportCategory.LABOUR_DISPUTE;

        // Decide the credential.
        // - Normal report: one secret access key, stored only as a SHA-256 hash (so the
        //   stored data can never reveal the reporter's key).
        // - HR grievance: no key at all; it is routed to HR instead.
        String accessKey = null;
        String keyHash = null;
        if (!isHrOnly) {
            accessKey = CaseReportUtils.generateAccessKey();
            keyHash = CaseReportUtils.sha256Hex(accessKey);
        }

        // Build the readable, non-secret case reference from WHEN the report arrived,
        // e.g. "SV/2026/0629/1408" (or "HR/..." for an HR grievance). Staff use this to
        // talk about the case; it carries no personal data and is not the database id.
        String caseRef = CaseReportUtils.buildCaseReference(isHrOnly ? "HR" : "SV", now);

        // The reference must be unique within the organisation. Because it is built down
        // to the minute, two reports filed in the same minute for the same tenant would
        // share one. If that happens we do NOT silently alter the reference — we stop and
        // ask the reporter to wait a minute and submit again (a new minute → a new, unique
        // reference). This keeps every reference a clean, one-to-one handle for a case.
        if (caseReportRepository.existsByTenantIdAndCaseReference(tenantId, caseRef)) {
            throw new CaseReferenceConflictException(
                    "Another report was just received this minute. Please wait one minute and submit again.");
        }

        // "oral" means the reporter wants a phone/voice channel; otherwise it is written.
        boolean oral = "oral".equalsIgnoreCase(request.getChannel());

        CaseReport caseReport = new CaseReport();
        // Do NOT set the id by hand — leaving it null lets MongoDB generate a real
        // ObjectId for _id. The readable "SV-..."/"HR-..." code is kept separately.
        caseReport.setCaseReference(caseRef);
        caseReport.setTenantId(tenantId);
        caseReport.setKeyHash(keyHash); //! Hashed of genarated...
        caseReport.setCategory(category);
        caseReport.setDescription(request.getFacts());
        caseReport.setIncidentDate(CaseReportUtils.parseIncidentDate(request.getIncidentDate()));
        caseReport.setDepartment(request.getArea());
        caseReport.setDisclosureMode(isHrOnly ? DisclosureMode.HR_HANDOFF : DisclosureMode.ANONYMOUS);
        caseReport.setIntakeChannel(isHrOnly ? IntakeChannel.HR_GRIEVANCE_HANDOFF : IntakeChannel.ANONYMOUS_WEB_PORTAL);
        caseReport.setStatus(CaseStatus.RECEIVED);
        caseReport.setSeverity(CaseSeverity.MEDIUM);
        caseReport.setSubmissionDate(now);

        // Legal context shown to the reporter on the tracking page.
        caseReport.setLawfulBasis("Legal obligation and protected follow-up under the Polish Whistleblower Protection Act 2024");
        caseReport.setController("DSV Corporation Pty Ltd - RegulaOne Poland");
        caseReport.setProcessor("SafeVoice EEA Processing Cluster");

        // Compliance SLAs: 7-day acknowledgement, 90-day (3-month) feedback deadline.
        caseReport.setAcknowledgementDue(now.plus(7, ChronoUnit.DAYS));
        caseReport.setFeedbackDue(now.plus(90, ChronoUnit.DAYS));

        // Record the reporter's communication choices as risk flags so staff can act on them.
        if (request.isRequestMeeting()) {
            caseReport.getRiskFlags().add("Meeting requested");
        }
        if (oral) {
            caseReport.getRiskFlags().add("Oral reporting requested");
        }

        // Keep ONLY the evidence file's name and size label — never any device/telemetry data.
        if (request.getAttachments() != null) {
            for (CaseSubmissionRequest.AttachmentMetadata meta : request.getAttachments()) {
                EvidenceAttachment attachment = new EvidenceAttachment();
                attachment.setDisplayName(meta.getDisplayName());
                attachment.setSizeLabel(meta.getSizeLabel());
                attachment.setMetadataStripped(true);
                attachment.setOriginalNameStored(false);
                caseReport.getAttachments().add(attachment);
            }
        }

        // Setup timeline (first event = intake).
        List<TimelineEvent> timeline = new ArrayList<>();
        timeline.add(new TimelineEvent(
                new org.bson.types.ObjectId().toHexString(),
                "Report Submitted",
                "Case intake completed via " + caseReport.getIntakeChannel().getLabel()
                        + ". Intake accepted without IP, device, browser, or geolocation storage.",
                now,
                "system"
        ));
        caseReport.setTimeline(timeline);

        CaseReport saved = caseReportRepository.save(caseReport);

        // Record compliance audit log (no reporter-identifying data is ever logged).
        auditLogService.log(
                tenantId,
                "Public Portal",
                "Anonymous Whistleblower",
                AuditActionType.REPORT_RECEIVED,
                saved.getId(),
                AuditOutcome.RECORDED,
                null,
                "Report category: " + saved.getCategory().name(),
                "Metadata stripped automatically on intake. Access key stored as a hash only."
        );

        // Return the plain key ONCE for display (null for HR grievances). It is now forgotten.
        return CaseSubmissionResponse.builder()
                .accessKey(accessKey)
                .hrOnly(isHrOnly)
                .build();
    }

    /**
     * Look a case up using ONLY the access key.
     *
     * We hash the key the reporter typed and match it against the stored fingerprint —
     * the plain key is never stored or compared directly. If nothing matches we answer
     * with a single "not found" (we never reveal whether a key "almost" matched), which
     * protects anonymity. A successful lookup is recorded in the audit trail.
     */
    public CaseReport retrieveByAccessKey(String accessKey) {
        if (accessKey == null || accessKey.isBlank()) {
            throw new IllegalArgumentException("Access key is required");
        }

        String keyHash = CaseReportUtils.sha256Hex(accessKey.trim());
        CaseReport report = caseReportRepository.findByKeyHash(keyHash)
                .orElseThrow(() -> new CaseNotFoundException("No case found for the provided access key"));

        if (report.isDeleted()) {
            throw new CaseNotFoundException("No case found for the provided access key");
        }

        auditLogService.log(
                report.getTenantId(),
                "Public Portal",
                "Anonymous Whistleblower",
                AuditActionType.ACCESS_REVIEW,
                report.getId(),
                AuditOutcome.RECORDED,
                null,
                "Case viewed via access key",
                "Reporter accessed their own case using a valid access key."
        );

        return report;
    }

    /**
     * Look a case up by its short case reference (the document id, e.g. "SV-1A2B3C4D5E").
     * Used by the message endpoints, where the reporter is already inside their case view.
     * No tenant filter is applied because the reporter has no tenant context.
     */
    public CaseReport getByCaseRef(String caseRef) {
        return caseReportRepository.findById(caseRef)
                .filter(r -> !r.isDeleted())
                .orElseThrow(() -> new CaseNotFoundException("No case found for reference: " + caseRef));
    }

    /**
     * Internal lookup by ID.
     */
    public CaseReport getById(String id, String tenantId) {
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
    public CaseReport updateStatus(String caseId, CaseStatus newStatus, String tenantId, String actorRole, String actorId) {
        CaseReport report = getById(caseId, tenantId);
        CaseStatus oldStatus = report.getStatus();
        if (oldStatus == newStatus) {
            return report;
        }

        report.setStatus(newStatus);
        report.getTimeline().add(new TimelineEvent(
                new org.bson.types.ObjectId().toHexString(),
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
    public CaseReport updateSeverity(String caseId, CaseSeverity newSeverity, String tenantId, String actorRole, String actorId) {
        CaseReport report = getById(caseId, tenantId);
        CaseSeverity oldSeverity = report.getSeverity();
        if (oldSeverity == newSeverity) {
            return report;
        }

        report.setSeverity(newSeverity);
        report.getTimeline().add(new TimelineEvent(
                new org.bson.types.ObjectId().toHexString(),
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
    public CaseReport assignInvestigator(String caseId, String investigator, String tenantId, String actorRole, String actorId) {
        CaseReport report = getById(caseId, tenantId);
        String oldInvestigator = report.getAssignedInvestigator();

        report.setAssignedInvestigator(investigator);
        report.getTimeline().add(new TimelineEvent(
                new org.bson.types.ObjectId().toHexString(),
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
    public CaseReport addAttachment(String caseId, com.safevoice.backend.model.embedded.EvidenceAttachment attachment, String tenantId) {
        CaseReport report = getById(caseId, tenantId);
        report.getAttachments().add(attachment);
        report.getTimeline().add(new TimelineEvent(
                new org.bson.types.ObjectId().toHexString(),
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
                attachment.getId(),
                "New evidence file hash verified: " + attachment.getSha256Checksum()
        );

        return saved;
    }
}
