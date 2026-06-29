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
 *   POST   /api/safevoice/reports/track            → look up a case by access key (returns the chat thread too)
 *   POST   /api/safevoice/reports/{caseId}/messages → post a message into the thread
 *
 * The reporter's ONLY credential is a single 64-character access key. There is no
 * tracking code and no PIN. We store only the key's hash, so the channel stays anonymous.
 *
 * NOTE: there is deliberately NO public "GET messages" endpoint. Reading a thread by
 * the (non-secret) case reference alone would let anyone who learns a reference read a
 * confidential thread without the access key. Reporters get their messages from /track
 * (proven by their key); staff read them via the authenticated internal cases API.
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
