package com.safevoice.backend.controller;

import com.safevoice.backend.dto.CaseSummaryResponse;
import com.safevoice.backend.dto.PageResponse;
import com.safevoice.backend.model.document.CaseMessage;
import com.safevoice.backend.model.document.CaseReport;
import com.safevoice.backend.model.document.RegulaOneUser;
import com.safevoice.backend.model.embedded.EncryptedPayload;
import com.safevoice.backend.model.embedded.EvidenceAttachment;
import com.safevoice.backend.model.enums.audit.AuditActionType;
import com.safevoice.backend.model.enums.audit.AuditOutcome;
import com.safevoice.backend.model.enums.case_report.CaseSeverity;
import com.safevoice.backend.model.enums.case_report.CaseStatus;
import com.safevoice.backend.repository.RegulaOneUserRepository;
import com.safevoice.backend.security.AuthenticatedUser;
import com.safevoice.backend.security.SafeVoicePermission;
import com.safevoice.backend.service.AttachmentService;
import com.safevoice.backend.service.AuditLogService;
import com.safevoice.backend.service.CaseMessageService;
import com.safevoice.backend.service.report.CaseReportService;

import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * REST controller representing internal compliance/investigator dashboards.
 *
 * Every method receives an {@link AuthenticatedUser} — resolved from the caller's session by
 * asking RegulaOne "who is this?" — which is both the auth gate (no valid session → 401) and
 * the source of truth for the tenant and the acting user. We NEVER take the tenant or actor
 * from a client-supplied header: doing so would let any valid user spoof another organisation.
 * Each method then calls {@code caller.requireAnyPermission(...)} to allow only the SafeVoice
 * roles that may perform that specific action (least privilege).
 */
@RestController
@RequestMapping("/api/v1/internal/cases")
@RequiredArgsConstructor
public class InternalCaseController {

    private final CaseReportService caseReportService;
    private final CaseMessageService caseMessageService;
    private final AttachmentService attachmentService;
    private final AuditLogService auditLogService;
    // Read-only lookup of RegulaOne users, so a staff reply is labelled with the person's NAME
    // (from the shared users collection) rather than their role code.
    private final RegulaOneUserRepository regulaOneUserRepository;

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
            AuthenticatedUser caller,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String filter) {
        caller.requireAnyPermission(
                SafeVoicePermission.SAFEVOICE_ADMIN,
                SafeVoicePermission.SAFEVOICE_COMPLIANCE_OFFICER,
                SafeVoicePermission.SAFEVOICE_INVESTIGATOR,
                SafeVoicePermission.SAFEVOICE_HR_MANAGER,
                SafeVoicePermission.SAFEVOICE_AUDITOR);
        PageResponse<CaseSummaryResponse> reports =
                caseReportService.listSummaries(caller.tenantId(), search, filter, page, size);
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
            AuthenticatedUser caller) {
        caller.requireAnyPermission(
                SafeVoicePermission.SAFEVOICE_ADMIN,
                SafeVoicePermission.SAFEVOICE_COMPLIANCE_OFFICER,
                SafeVoicePermission.SAFEVOICE_INVESTIGATOR,
                SafeVoicePermission.SAFEVOICE_HR_MANAGER,
                SafeVoicePermission.SAFEVOICE_AUDITOR);
        CaseReport report = caseReportService.getById(caseId, caller.tenantId());
        return ResponseEntity.ok(report);
    }

    /**
     * Update case status.
     */
    // Allowed permissions: SAFEVOICE_ADMIN, SAFEVOICE_COMPLIANCE_OFFICER, SAFEVOICE_INVESTIGATOR
    // Why: moving a case through its lifecycle is case-management/progress work done by handlers
    // and the assigned investigator. HR managers and auditors remain view-only for case state.
    @PatchMapping("/{caseId}/status")
    public ResponseEntity<CaseReport> updateStatus(
            @PathVariable String caseId,
            @RequestParam("status") CaseStatus status,
            // Required only when reopening a CLOSED case; the service validates that. Optional here
            // so normal forward transitions need no reason.
            @RequestParam(value = "reason", required = false) String reason,
            AuthenticatedUser caller) {
        caller.requireAnyPermission(
                SafeVoicePermission.SAFEVOICE_ADMIN,
                SafeVoicePermission.SAFEVOICE_COMPLIANCE_OFFICER,
                SafeVoicePermission.SAFEVOICE_INVESTIGATOR);
        CaseReport updated = caseReportService.updateStatus(
                caseId, status, reason, caller.tenantId(), caller.primarySafeVoiceRole(), caller.userId());
        return ResponseEntity.ok(updated);
    }

    /**
     * Update case severity.
     */
    // Allowed permissions: SAFEVOICE_ADMIN, SAFEVOICE_COMPLIANCE_OFFICER, SAFEVOICE_INVESTIGATOR
    // Why: re-assessing severity/priority is triage/progress work done by handlers and the
    // assigned investigator. HR managers and auditors remain view-only for case state.
    @PatchMapping("/{caseId}/severity")
    public ResponseEntity<CaseReport> updateSeverity(
            @PathVariable String caseId,
            @RequestParam("severity") CaseSeverity severity,
            AuthenticatedUser caller) {
        caller.requireAnyPermission(
                SafeVoicePermission.SAFEVOICE_ADMIN,
                SafeVoicePermission.SAFEVOICE_COMPLIANCE_OFFICER,
                SafeVoicePermission.SAFEVOICE_INVESTIGATOR);
        CaseReport updated = caseReportService.updateSeverity(
                caseId, severity, caller.tenantId(), caller.primarySafeVoiceRole(), caller.userId());
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
            AuthenticatedUser caller) {
        caller.requireAnyPermission(
                SafeVoicePermission.SAFEVOICE_ADMIN,
                SafeVoicePermission.SAFEVOICE_COMPLIANCE_OFFICER);
        CaseReport updated = caseReportService.assignInvestigator(
                caseId, investigator, caller.tenantId(), caller.primarySafeVoiceRole(), caller.userId());
        return ResponseEntity.ok(updated);
    }

    /**
     * Post a chat message (with optional evidence files) as internal staff. Sent as
     * multipart/form-data: a "text" field plus zero or more "files" parts.
     */
    // Allowed permissions: SAFEVOICE_ADMIN, SAFEVOICE_COMPLIANCE_OFFICER, SAFEVOICE_INVESTIGATOR
    // Why: replying in the case thread (and attaching files to it) is active case work done by
    // handlers and the assigned investigator. Auditors are strictly read-only, and HR managers
    // only triage grievances, so neither writes to the reporter thread.
    @PostMapping(value = "/{caseId}/messages", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<CaseMessage> postMessage(
            @PathVariable String caseId,
            @RequestParam(value = "text", required = false) String text,
            // The three parts of a reply the staff browser already locked (encrypted). For a normal
            // case staff send these INSTEAD of plain "text", so the server stores words it cannot
            // read. Optional so a files-only reply still works.
            @RequestParam(value = "ciphertext", required = false) String ciphertext,
            @RequestParam(value = "iv", required = false) String iv,
            @RequestParam(value = "wrappedKey", required = false) String wrappedKey,
            @RequestParam(value = "algorithm", required = false) String algorithm,
            @RequestParam(value = "files", required = false) List<MultipartFile> files,
            AuthenticatedUser caller) {
        caller.requireAnyPermission(
                SafeVoicePermission.SAFEVOICE_ADMIN,
                SafeVoicePermission.SAFEVOICE_COMPLIANCE_OFFICER,
                SafeVoicePermission.SAFEVOICE_INVESTIGATOR);
        // Validate + store any attached files first (type/size/count checks live in the service).
        List<EvidenceAttachment> attachments = attachmentService.uploadAll(files);
        // Build the locked-text payload from the form parts (null if staff sent none).
        EncryptedPayload encryptedText = EncryptedPayload.fromParts(ciphertext, iv, wrappedKey, algorithm);
        // Both the audit actor and the thread sender label come from the verified session, never
        // a header. The audit still records the ROLE (for traceability); the sender shown in the
        // thread is the staff member's NAME so the reporter/staff see who replied, not a role code.
        String actorRole = caller.primarySafeVoiceRole(); // e.g. SAFEVOICE_COMPLIANCE_OFFICER
        CaseMessage message = caseMessageService.postMessage(
                caseId,
                text,
                encryptedText,
                resolveSenderName(caller),
                caller.tenantId(),
                actorRole,
                caller.userId(),
                attachments
        );
        return ResponseEntity.ok(message);
    }

    /**
     * The display name to label a staff member's chat message with, looked up from the shared
     * RegulaOne users collection by the caller's id. Falls back so the sender is never blank:
     * the user's e-mail, then their role code.
     */
    private String resolveSenderName(AuthenticatedUser caller) {
        String name = regulaOneUserRepository.findById(caller.userId())
                .map(RegulaOneUser::getName)
                .filter(n -> n != null && !n.isBlank())
                .orElse(null);
        if (name != null) {
            return name;
        }
        if (caller.email() != null && !caller.email().isBlank()) {
            return caller.email();
        }
        return caller.primarySafeVoiceRole();
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
            AuthenticatedUser caller) {
        caller.requireAnyPermission(
                SafeVoicePermission.SAFEVOICE_ADMIN,
                SafeVoicePermission.SAFEVOICE_COMPLIANCE_OFFICER,
                SafeVoicePermission.SAFEVOICE_INVESTIGATOR,
                SafeVoicePermission.SAFEVOICE_HR_MANAGER,
                SafeVoicePermission.SAFEVOICE_AUDITOR);
        List<CaseMessage> messages = caseMessageService.getMessages(caseId, caller.tenantId());
        return ResponseEntity.ok(messages);
    }

    /**
     * Download attachment file securely from vault.
     */
    // Allowed permissions: SAFEVOICE_ADMIN, SAFEVOICE_AUDITOR
    // Why: this maps to the "Export" (Eksport) capability in the permission matrix — pulling the
    // raw evidence bytes OUT of the vault, not just seeing that a file exists (the case view shows
    // filenames/metadata to every role). The matrix grants Export only to the Administrator and
    // the Auditor, so Compliance Officer, Investigator and HR Manager are blocked here.
    @GetMapping("/{caseId}/attachments/{attachmentId}")
    public ResponseEntity<byte[]> downloadAttachment(
            @PathVariable String caseId,
            @PathVariable String attachmentId,
            AuthenticatedUser caller) {
        caller.requireAnyPermission(
                SafeVoicePermission.SAFEVOICE_ADMIN,
                SafeVoicePermission.SAFEVOICE_AUDITOR);
        // Enforce tenant authorization and case existence
        CaseReport report = caseReportService.getById(caseId, caller.tenantId());

        // Find the attachment metadata entry
        EvidenceAttachment attachment = report.getAttachments().stream()
                .filter(a -> a.getId().equals(attachmentId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Attachment not found in this case"));

        byte[] fileBytes = attachmentService.getFile(attachment.getStorageVaultRef());

        // Record WHO exported WHICH evidence, WHEN — the most sensitive action in the system.
        // Identity comes from the verified session; we log the attachment id + checksum, never
        // the file contents or the reporter's identity.
        auditLogService.log(
                caller.tenantId(),
                caller.primarySafeVoiceRole(),
                caller.userId(),
                AuditActionType.EVIDENCE_EXPORTED,
                caseId,
                AuditOutcome.RECORDED,
                null,
                attachment.getId(),
                "Case evidence file exported (sha256=" + attachment.getSha256Checksum() + ")."
        );

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + attachment.getDisplayName() + "\"")
                .header("X-Content-Type-Options", "nosniff")
                .body(fileBytes);
    }

    /**
     * Download a file that is attached to ONE chat message in the thread (as opposed to a
     * file attached to the case at submission time, handled above).
     */
    // Allowed permissions: SAFEVOICE_ADMIN, SAFEVOICE_AUDITOR
    // Why: same "Export" (Eksport) capability as the case-level download — pulling the raw
    // bytes out is limited to Administrator and Auditor, per the permission matrix.
    @GetMapping("/{caseId}/messages/{messageId}/attachments/{attachmentId}")
    public ResponseEntity<byte[]> downloadMessageAttachment(
            @PathVariable String caseId,
            @PathVariable String messageId,
            @PathVariable String attachmentId,
            AuthenticatedUser caller) {
        caller.requireAnyPermission(
                SafeVoicePermission.SAFEVOICE_ADMIN,
                SafeVoicePermission.SAFEVOICE_AUDITOR);
        // The service checks the message really belongs to this tenant + case before returning it.
        EvidenceAttachment attachment = caseMessageService.getMessageAttachment(
                caseId, messageId, attachmentId, caller.tenantId());

        byte[] fileBytes = attachmentService.getFile(attachment.getStorageVaultRef());

        // Audit the export (see downloadAttachment above). Include the message id in the notice.
        auditLogService.log(
                caller.tenantId(),
                caller.primarySafeVoiceRole(),
                caller.userId(),
                AuditActionType.EVIDENCE_EXPORTED,
                caseId,
                AuditOutcome.RECORDED,
                null,
                attachment.getId(),
                "Thread evidence file exported (messageId=" + messageId
                        + ", sha256=" + attachment.getSha256Checksum() + ")."
        );

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + attachment.getDisplayName() + "\"")
                .header("X-Content-Type-Options", "nosniff")
                .body(fileBytes);
    }
}
