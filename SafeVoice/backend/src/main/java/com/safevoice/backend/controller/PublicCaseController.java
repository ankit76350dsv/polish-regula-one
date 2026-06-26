package com.safevoice.backend.controller;

import com.safevoice.backend.dto.CaseRetrievalRequest;
import com.safevoice.backend.dto.CaseSubmissionRequest;
import com.safevoice.backend.dto.CaseSubmissionResponse;
import com.safevoice.backend.model.document.CaseMessage;
import com.safevoice.backend.model.document.CaseReport;
import com.safevoice.backend.model.embedded.EvidenceAttachment;
import com.safevoice.backend.service.AttachmentService;
import com.safevoice.backend.service.CaseMessageService;
import com.safevoice.backend.service.CaseReportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * REST controller representing public endpoints for whistleblowers.
 * Enforces tenant isolation via X-Tenant-ID headers and verifies PIN code ownership.
 */
@RestController
@RequestMapping("/api/v1/public/cases")
@RequiredArgsConstructor
public class PublicCaseController {

    private final CaseReportService caseReportService;
    private final CaseMessageService caseMessageService;
    private final AttachmentService attachmentService;

    /**
     * Submit a new case report.
     */
    @PostMapping("/submit")
    public ResponseEntity<CaseSubmissionResponse> submit(
            @Valid @RequestBody CaseSubmissionRequest request,
            @RequestHeader("X-Tenant-ID") String tenantId) {
        CaseSubmissionResponse response = caseReportService.submit(request, tenantId);
        return ResponseEntity.ok(response);
    }

    /**
     * Retrieve the case status, timeline, and attributes.
     * Enforces case code and PIN verification.
     */
    @PostMapping("/retrieve")
    public ResponseEntity<CaseReport> retrieve(
            @Valid @RequestBody CaseRetrievalRequest request,
            @RequestHeader("X-Tenant-ID") String tenantId) {
        CaseReport report = caseReportService.retrieve(request.getTrackingCode(), request.getPin(), tenantId);
        return ResponseEntity.ok(report);
    }

    /**
     * Post a chat message inside the case channel.
     * Enforces case ownership verification.
     */
    @PostMapping("/{caseId}/messages")
    public ResponseEntity<CaseMessage> postMessage(
            @PathVariable String caseId,
            @RequestParam("trackingCode") String trackingCode,
            @RequestParam(value = "pin", required = false) String pin,
            @RequestBody String text,
            @RequestHeader("X-Tenant-ID") String tenantId) {
        // Enforce ownership verification
        caseReportService.retrieve(trackingCode, pin, tenantId);

        CaseMessage message = caseMessageService.postMessage(
                caseId,
                text,
                "Reporter",
                tenantId,
                "Public Portal",
                "Anonymous Whistleblower"
        );
        return ResponseEntity.ok(message);
    }

    /**
     * Retrieve the chat log for the case.
     * Enforces case ownership verification.
     */
    @GetMapping("/{caseId}/messages")
    public ResponseEntity<List<CaseMessage>> getMessages(
            @PathVariable String caseId,
            @RequestParam("trackingCode") String trackingCode,
            @RequestParam(value = "pin", required = false) String pin,
            @RequestHeader("X-Tenant-ID") String tenantId) {
        // Enforce ownership verification
        caseReportService.retrieve(trackingCode, pin, tenantId);

        List<CaseMessage> messages = caseMessageService.getMessages(caseId, tenantId);
        return ResponseEntity.ok(messages);
    }

    /**
     * Upload an evidence file attachment for a case.
     * Enforces case ownership verification and security whitelists.
     */
    @PostMapping(value = "/{caseId}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<EvidenceAttachment> uploadAttachment(
            @PathVariable String caseId,
            @RequestParam("trackingCode") String trackingCode,
            @RequestParam(value = "pin", required = false) String pin,
            @RequestParam("file") MultipartFile file,
            @RequestHeader("X-Tenant-ID") String tenantId) {
        // Enforce ownership verification
        caseReportService.retrieve(trackingCode, pin, tenantId);

        EvidenceAttachment attachment = attachmentService.upload(file);
        caseReportService.addAttachment(caseId, attachment, tenantId);

        return ResponseEntity.ok(attachment);
    }
}
