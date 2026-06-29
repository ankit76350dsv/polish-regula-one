package com.safevoice.backend.service.report;

import com.safevoice.backend.dto.CaseSubmissionRequest;
import com.safevoice.backend.dto.CaseSubmissionResponse;
import com.safevoice.backend.dto.CaseSummaryResponse;
import com.safevoice.backend.dto.PageResponse;
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
import com.safevoice.backend.repository.CaseMessageRepository;
import com.safevoice.backend.repository.CaseReportRepository;
import com.safevoice.backend.repository.TenantRepository;
import com.safevoice.backend.service.AuditLogService;
import com.safevoice.backend.service.report.utils.CaseReportUtils;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Service orchestrating operations on CaseReport documents.
 */
@Service
public class CaseReportService {

    private final CaseReportRepository caseReportRepository;
    private final CaseMessageRepository caseMessageRepository;
    private final TenantRepository tenantRepository;
    private final AuditLogService auditLogService;
    // Used for the case-register list, which needs flexible search/filter/sort/paging
    // that fixed repository methods cannot express. MongoTemplate lets us build the
    // query dynamically and safely (user text is escaped before it reaches the DB).
    private final MongoTemplate mongoTemplate;

    // Hard ceiling on page size, so a caller can never ask for a giant page that would
    // strain the database or the browser. Requests above this are clamped down to it.
    private static final int MAX_PAGE_SIZE = 200;
    private static final int DEFAULT_PAGE_SIZE = 20;

    @Autowired
    public CaseReportService(CaseReportRepository caseReportRepository,
                             CaseMessageRepository caseMessageRepository,
                             TenantRepository tenantRepository,
                             AuditLogService auditLogService,
                             MongoTemplate mongoTemplate) {
        this.caseReportRepository = caseReportRepository;
        this.caseMessageRepository = caseMessageRepository;
        this.tenantRepository = tenantRepository;
        this.auditLogService = auditLogService;
        this.mongoTemplate = mongoTemplate;
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
     * Lists active cases for a tenant (full documents). Kept for internal callers that
     * genuinely need the whole case; the staff register uses {@link #listSummaries} instead.
     */
    public List<CaseReport> list(String tenantId) {
        return caseReportRepository.findAllByTenantIdAndDeletedFalse(tenantId);
    }

    /**
     * Build ONE PAGE of the staff "case register", with optional search and a filter.
     *
     * For each case on the page we return only the columns the table shows, plus how many
     * of the reporter's messages staff have not read yet (for the unread badge). We never
     * include the description, access-key hash, timeline, or attachments here — the list
     * does not need them, and leaving them out keeps that sensitive data off the wire
     * (data minimisation). The full case is loaded only when a staff member opens one.
     *
     * Every input is treated as untrusted and made safe:
     *  - tenantId is required (we never list across organisations).
     *  - page below 1 becomes 1; size is clamped to a sane default and a hard maximum.
     *  - a blank search is ignored; a non-blank one is escaped before it touches the DB
     *    (so characters like "(" or "*" can never act as a regex or break the query).
     *  - an unknown filter is treated as "all".
     *
     * @param tenantId the organisation whose cases to list (required)
     * @param search   free text matched against the case reference and category (optional)
     * @param filter   one of: all, critical, unassigned, feedbackDue (optional)
     * @param page     1-based page number
     * @param size     rows per page
     */
    public PageResponse<CaseSummaryResponse> listSummaries(String tenantId, String search,
                                                           String filter, int page, int size) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new IllegalArgumentException("Tenant info/context is required");
        }

        // Clamp paging inputs so a bad/missing value can never break the query.
        int safePage = page < 1 ? 1 : page;
        int safeSize = size < 1 ? DEFAULT_PAGE_SIZE : Math.min(size, MAX_PAGE_SIZE);

        // Always scope to this tenant and skip soft-deleted cases.
        List<Criteria> conditions = new ArrayList<>();
        conditions.add(Criteria.where("tenantId").is(tenantId));
        conditions.add(Criteria.where("deleted").is(false));

        // The quick filter buttons in the register. Anything unrecognised means "all".
        String activeFilter = filter == null ? "" : filter.trim().toLowerCase();
        switch (activeFilter) {
            case "critical" -> conditions.add(Criteria.where("severity").is(CaseSeverity.CRITICAL));
            case "unassigned" -> conditions.add(new Criteria().orOperator(
                    Criteria.where("assignedInvestigator").is(null),
                    Criteria.where("assignedInvestigator").is("Unassigned"),
                    Criteria.where("assignedInvestigator").exists(false)));
            case "feedbackdue" -> conditions.add(Criteria.where("status").ne(CaseStatus.CLOSED));
            default -> { /* "all" or unknown → no extra condition */ }
        }

        // Free-text search across the readable reference and the category. The user's
        // text is quoted so it is matched literally (no regex injection), case-insensitive.
        if (search != null && !search.isBlank()) {
            String literal = Pattern.quote(search.trim());
            conditions.add(new Criteria().orOperator(
                    Criteria.where("caseReference").regex(literal, "i"),
                    Criteria.where("category").regex(literal, "i")));
        }

        Criteria all = new Criteria().andOperator(conditions.toArray(new Criteria[0]));

        // Count the full match set first (for the pager), then fetch only this page,
        // newest first. If the requested page is past the end, the fetch simply returns
        // an empty list — a valid, non-error outcome.
        long total = mongoTemplate.count(Query.query(all), CaseReport.class);
        Query pageQuery = Query.query(all)
                .with(Sort.by(Sort.Direction.DESC, "submissionDate"))
                .skip((long) (safePage - 1) * safeSize)
                .limit(safeSize);
        List<CaseReport> reports = mongoTemplate.find(pageQuery, CaseReport.class);

        List<CaseSummaryResponse> items = new ArrayList<>();
        for (CaseReport report : reports) {
            // Count this case's still-unread (by staff) messages for the badge.
            long unread = caseMessageRepository
                    .countByTenantIdAndCaseIdAndReadByAdminFalse(tenantId, report.getId());
            items.add(CaseSummaryResponse.builder()
                    .id(report.getId())
                    .caseReference(report.getCaseReference())
                    .disclosureMode(report.getDisclosureMode())
                    .category(report.getCategory())
                    .status(report.getStatus())
                    .severity(report.getSeverity())
                    .assignedInvestigator(report.getAssignedInvestigator())
                    .feedbackDue(report.getFeedbackDue())
                    .unreadCount(unread)
                    .build());
        }

        int totalPages = (int) Math.ceil((double) total / safeSize);
        return PageResponse.<CaseSummaryResponse>builder()
                .items(items)
                .page(safePage)
                .size(safeSize)
                .total(total)
                .totalPages(totalPages)
                .build();
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
