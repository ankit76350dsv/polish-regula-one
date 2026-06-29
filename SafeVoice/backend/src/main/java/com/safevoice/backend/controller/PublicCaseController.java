package com.safevoice.backend.controller;

import com.safevoice.backend.dto.CaseMessageRequest;
import com.safevoice.backend.dto.CaseRetrievalRequest;
import com.safevoice.backend.dto.CaseSubmissionRequest;
import com.safevoice.backend.dto.CaseSubmissionResponse;
import com.safevoice.backend.dto.CaseTrackingResponse;
import com.safevoice.backend.model.document.CaseMessage;
import com.safevoice.backend.model.document.CaseReport;
import com.safevoice.backend.model.embedded.EvidenceAttachment;
import com.safevoice.backend.service.AttachmentService;
import com.safevoice.backend.service.CaseMessageService;
import com.safevoice.backend.service.report.CaseReportService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * Public, anonymous endpoints for whistleblowers (no login required).
 *
 * These match exactly what the SafeVoice web form sends:
 *   POST   /api/safevoice/reports                  → submit a new report
 *   POST   /api/safevoice/reports/track            → look up a case by access key
 *   GET    /api/safevoice/reports/{caseId}/messages → read the case chat thread
 *   POST   /api/safevoice/reports/{caseId}/messages → post a message into the thread
 *
 * The reporter's ONLY credential is a single 64-character access key. There is no
 * tracking code and no PIN. We store only the key's hash, so the channel stays anonymous.
 */
@RestController
@RequestMapping("/api/safevoice/reports")
@RequiredArgsConstructor
public class PublicCaseController {

    private final CaseReportService caseReportService;
    private final CaseMessageService caseMessageService;
    private final AttachmentService attachmentService;

    /**
     * Submit a new report. Returns the one-time access key (null for HR grievances).
     * Validation failures and bad input are turned into clear JSON errors by the
     * global exception handler.
     */
    @PostMapping
    public ResponseEntity<CaseSubmissionResponse> submit(
            @Valid @RequestBody CaseSubmissionRequest request) {
        CaseSubmissionResponse response = caseReportService.submit(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Look up a case using only the access key, and return the case plus its chat thread.
     */
    @PostMapping("/track")
    public ResponseEntity<CaseTrackingResponse> track(
            @Valid @RequestBody CaseRetrievalRequest request) {
        CaseReport report = caseReportService.retrieveByAccessKey(request.getAccessKey());
        List<CaseMessage> messages = caseMessageService.getMessages(report.getId(), report.getTenantId());
        return ResponseEntity.ok(CaseTrackingResponse.builder()
                .report(report)
                .messages(messages)
                .build());
    }

    /**
     * Read the chat thread for a case. The case is found by its short reference (the id
     * the reporter received after looking the case up with their key).
     *
     * SECURITY NOTE: this resolves the case by its reference alone. The reference is only
     * known to someone who already proved they hold the access key, but it is not itself a
     * secret. A stronger design would carry the access key on this call too; see the change
     * report. For now this matches the web app's current contract.
     */
    @GetMapping("/{caseId}/messages")
    public ResponseEntity<List<CaseMessage>> getMessages(@PathVariable String caseId) {
        CaseReport report = caseReportService.getByCaseRef(caseId);
        List<CaseMessage> messages = caseMessageService.getMessages(report.getId(), report.getTenantId());
        return ResponseEntity.ok(messages);
    }

    /**
     * Post a message into a case's chat thread (reporter side).
     */
    @PostMapping("/{caseId}/messages")
    public ResponseEntity<CaseMessage> postMessage(
            @PathVariable String caseId,
            @Valid @RequestBody CaseMessageRequest request) {
        CaseReport report = caseReportService.getByCaseRef(caseId);

        String sender = (request.getSender() == null || request.getSender().isBlank())
                ? "Anonymous Whistleblower"
                : request.getSender();

        CaseMessage message = caseMessageService.postMessage(
                report.getId(),
                request.getText(),
                sender,
                report.getTenantId(),
                "Public Portal",
                "Anonymous Whistleblower"
        );
        return ResponseEntity.ok(message);
    }

    /**
     * Upload an evidence file for an existing case. Not used by the standard submit flow
     * (the form sends file metadata inside the submit request), but kept for clients that
     * upload the actual file later. Ownership is resolved by the case reference.
     */
    @PostMapping(value = "/{caseId}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<EvidenceAttachment> uploadAttachment(
            @PathVariable String caseId,
            @RequestParam("file") MultipartFile file) {
        CaseReport report = caseReportService.getByCaseRef(caseId);

        EvidenceAttachment attachment = attachmentService.upload(file);
        caseReportService.addAttachment(report.getId(), attachment, report.getTenantId());

        return ResponseEntity.ok(attachment);
    }
}
