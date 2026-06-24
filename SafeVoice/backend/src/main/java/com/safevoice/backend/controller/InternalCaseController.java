package com.safevoice.backend.controller;

import com.safevoice.backend.model.document.CaseMessage;
import com.safevoice.backend.model.document.CaseReport;
import com.safevoice.backend.model.embedded.EvidenceAttachment;
import com.safevoice.backend.model.enums.case_report.CaseSeverity;
import com.safevoice.backend.model.enums.case_report.CaseStatus;
import com.safevoice.backend.service.AttachmentService;
import com.safevoice.backend.service.CaseMessageService;
import com.safevoice.backend.service.CaseReportService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * REST controller representing internal compliance/investigator dashboards.
 * Enforces tenant isolation via headers and records audits.
 */
@RestController
@RequestMapping("/api/v1/internal/cases")
public class InternalCaseController {

    private final CaseReportService caseReportService;
    private final CaseMessageService caseMessageService;
    private final AttachmentService attachmentService;

    @Autowired
    public InternalCaseController(
            CaseReportService caseReportService,
            CaseMessageService caseMessageService,
            AttachmentService attachmentService) {
        this.caseReportService = caseReportService;
        this.caseMessageService = caseMessageService;
        this.attachmentService = attachmentService;
    }

    /**
     * Lists active whistleblower cases for the tenant.
     */
    @GetMapping
    public ResponseEntity<List<CaseReport>> list(
            @RequestHeader("X-Tenant-ID") String tenantId) {
        List<CaseReport> reports = caseReportService.list(tenantId);
        return ResponseEntity.ok(reports);
    }

    /**
     * Retrieve complete case report details.
     */
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
