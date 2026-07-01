package com.safevoice.backend.controller;

import com.safevoice.backend.dto.CaseSummaryResponse;
import com.safevoice.backend.dto.PageResponse;
import com.safevoice.backend.model.document.CaseMessage;
import com.safevoice.backend.model.document.CaseReport;
import com.safevoice.backend.model.embedded.EvidenceAttachment;
import com.safevoice.backend.model.enums.case_report.CaseSeverity;
import com.safevoice.backend.model.enums.case_report.CaseStatus;
import com.safevoice.backend.service.AttachmentService;
import com.safevoice.backend.service.CaseMessageService;
import com.safevoice.backend.service.report.CaseReportService;

import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller representing internal compliance/investigator dashboards.
 * Enforces tenant isolation via headers and records audits.
 */
@RestController
@RequestMapping("/api/v1/internal/cases")
@RequiredArgsConstructor
public class InternalCaseController {

    private final CaseReportService caseReportService;
    private final CaseMessageService caseMessageService;
    private final AttachmentService attachmentService;

    /**
     * Lists whistleblower cases for the tenant as a PAGE of slim summaries — only the
     * columns the register table shows, plus an unread-message count for the badge.
     * Supports free-text search and a quick filter, and returns paging info for the UI.
     * The full case (description, timeline, attachments, …) is returned only by
     * {@link #getById}, when a staff member opens one case.
     *
     * Query parameters (all optional, with safe defaults):
     *   page   1-based page number (default 1)
     *   size   rows per page (default 20, capped server-side)
     *   search free text matched against case reference and category
     *   filter one of: all | critical | unassigned | feedbackDue
     */
    // Allowed permissions: SAFEVOICE_ADMIN, SAFEVOICE_COMPLIANCE_OFFICER, SAFEVOICE_INVESTIGATOR,
    //                       SAFEVOICE_HR_MANAGER, SAFEVOICE_AUDITOR
    // Why: read-only listing of the case register. Every SafeVoice role has "view reports",
    // so all of them may see the list (it exposes no case content, only summary columns).
    @GetMapping
    public ResponseEntity<PageResponse<CaseSummaryResponse>> list(
            @RequestHeader("X-Tenant-ID") String tenantId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String filter) {
        PageResponse<CaseSummaryResponse> reports =
                caseReportService.listSummaries(tenantId, search, filter, page, size);
        return ResponseEntity.ok(reports);
    }

    /**
     * Retrieve complete case report details.
     */
    // Allowed permissions: SAFEVOICE_ADMIN, SAFEVOICE_COMPLIANCE_OFFICER, SAFEVOICE_INVESTIGATOR,
    //                       SAFEVOICE_HR_MANAGER, SAFEVOICE_AUDITOR
    // Why: opening a single case to read it is view access, which every SafeVoice role holds.
    @GetMapping("/{caseId}")
    public ResponseEntity<CaseReport> getById(
            @PathVariable String caseId,
            @RequestHeader("X-Tenant-ID") String tenantId) {
        CaseReport report = caseReportService.getById(caseId, tenantId);
        return ResponseEntity.ok(report);
    }

    /**
     * Update case status.
     */
    // Allowed permissions: SAFEVOICE_ADMIN, SAFEVOICE_COMPLIANCE_OFFICER
    // Why: moving a case through its lifecycle (e.g. to Closed) is a case-management decision.
    // View-only roles (Investigator, HR Manager, Auditor) must not change case state.
    @PatchMapping("/{caseId}/status")
    public ResponseEntity<CaseReport> updateStatus(
            @PathVariable String caseId,
            @RequestParam("status") CaseStatus status,
            @RequestHeader("X-Tenant-ID") String tenantId,
            @RequestHeader("X-Actor-Role") String actorRole,
            @RequestHeader("X-Actor-ID") String actorId) {
        CaseReport updated = caseReportService.updateStatus(caseId, status, tenantId, actorRole, actorId);
        return ResponseEntity.ok(updated);
    }

    /**
     * Update case severity.
     */
    // Allowed permissions: SAFEVOICE_ADMIN, SAFEVOICE_COMPLIANCE_OFFICER
    // Why: re-assessing severity/priority is a triage decision reserved for case managers;
    // view-only roles should not be able to re-prioritise a case.
    @PatchMapping("/{caseId}/severity")
    public ResponseEntity<CaseReport> updateSeverity(
            @PathVariable String caseId,
            @RequestParam("severity") CaseSeverity severity,
            @RequestHeader("X-Tenant-ID") String tenantId,
            @RequestHeader("X-Actor-Role") String actorRole,
            @RequestHeader("X-Actor-ID") String actorId) {
        CaseReport updated = caseReportService.updateSeverity(caseId, severity, tenantId, actorRole, actorId);
        return ResponseEntity.ok(updated);
    }

    /**
     * Assign investigator to case.
     */
    // Allowed permissions: SAFEVOICE_ADMIN, SAFEVOICE_COMPLIANCE_OFFICER
    // Why: assigning ownership of a case is the "assign cases" management capability; only
    // admins and compliance officers hold it. Investigators receive cases, they do not route them.
    @PatchMapping("/{caseId}/assign")
    public ResponseEntity<CaseReport> assignInvestigator(
            @PathVariable String caseId,
            @RequestParam("investigator") String investigator,
            @RequestHeader("X-Tenant-ID") String tenantId,
            @RequestHeader("X-Actor-Role") String actorRole,
            @RequestHeader("X-Actor-ID") String actorId) {
        CaseReport updated = caseReportService.assignInvestigator(caseId, investigator, tenantId, actorRole, actorId);
        return ResponseEntity.ok(updated);
    }

    /**
     * Post chat message as internal manager.
     */
    // Allowed permissions: SAFEVOICE_ADMIN, SAFEVOICE_COMPLIANCE_OFFICER, SAFEVOICE_INVESTIGATOR
    // Why: replying in the case thread is active case work done by handlers and the assigned
    // investigator. Auditors are strictly read-only, and HR managers only triage grievances,
    // so neither writes to the reporter thread.
    @PostMapping("/{caseId}/messages")
    public ResponseEntity<CaseMessage> postMessage(
            @PathVariable String caseId,
            @RequestBody String text,
            @RequestHeader("X-Tenant-ID") String tenantId,
            @RequestHeader("X-Actor-Role") String actorRole,
            @RequestHeader("X-Actor-ID") String actorId) {
        CaseMessage message = caseMessageService.postMessage(
                caseId,
                text,
                actorRole, // e.g. "Compliance Officer"
                tenantId,
                actorRole,
                actorId
        );
        return ResponseEntity.ok(message);
    }

    /**
     * Get chat log stream.
     */
    // Allowed permissions: SAFEVOICE_ADMIN, SAFEVOICE_COMPLIANCE_OFFICER, SAFEVOICE_INVESTIGATOR,
    //                       SAFEVOICE_HR_MANAGER, SAFEVOICE_AUDITOR
    // Why: reading the case thread is part of viewing a case, which every SafeVoice role may do
    // (posting to it is separately restricted above).
    @GetMapping("/{caseId}/messages")
    public ResponseEntity<List<CaseMessage>> getMessages(
            @PathVariable String caseId,
            @RequestHeader("X-Tenant-ID") String tenantId) {
        List<CaseMessage> messages = caseMessageService.getMessages(caseId, tenantId);
        return ResponseEntity.ok(messages);
    }

    /**
     * Download attachment file securely from vault.
     */
    // Allowed permissions: SAFEVOICE_ADMIN, SAFEVOICE_COMPLIANCE_OFFICER, SAFEVOICE_INVESTIGATOR,
    //                       SAFEVOICE_AUDITOR
    // Why: downloading the raw evidence file (not just its metadata) is case work for the
    // investigator/compliance officer and review/export for the auditor. HR managers only
    // triage grievances and do not handle evidence, so they are excluded.
    @GetMapping("/{caseId}/attachments/{attachmentId}")
    public ResponseEntity<byte[]> downloadAttachment(
            @PathVariable String caseId,
            @PathVariable String attachmentId,
            @RequestHeader("X-Tenant-ID") String tenantId) {
        // Enforce tenant authorization and case existence
        CaseReport report = caseReportService.getById(caseId, tenantId);

        // Find the attachment metadata entry
        EvidenceAttachment attachment = report.getAttachments().stream()
                .filter(a -> a.getId().equals(attachmentId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Attachment not found in this case"));

        byte[] fileBytes = attachmentService.getFile(attachment.getStorageVaultRef());

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + attachment.getDisplayName() + "\"")
                .body(fileBytes);
    }
}
