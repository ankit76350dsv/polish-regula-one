package com.safevoice.backend.controller;

import com.safevoice.backend.dto.CaseRetrievalRequest;
import com.safevoice.backend.dto.CaseSubmissionRequest;
import com.safevoice.backend.dto.CaseSubmissionResponse;
import com.safevoice.backend.dto.CaseTrackingResponse;
import com.safevoice.backend.dto.ReporterAttachmentRequest;
import com.safevoice.backend.model.document.CaseMessage;
import com.safevoice.backend.model.document.CaseReport;
import com.safevoice.backend.model.embedded.EvidenceAttachment;
import com.safevoice.backend.service.AttachmentService;
import com.safevoice.backend.service.CaseMessageService;
import com.safevoice.backend.service.report.CaseReportService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpHeaders;
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
    // Allowed permissions: NONE — public, anonymous reporter endpoint (no staff role).
    // Why: whistleblowers have no account; a report is created before any credential exists,
    // so requiring a SAFEVOICE_* permission here would make anonymous reporting impossible.
    @PostMapping
    public ResponseEntity<CaseSubmissionResponse> submit(
            @Valid @RequestBody CaseSubmissionRequest request) {
        CaseSubmissionResponse response = caseReportService.submit(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Look up a case using only the access key, and return the case plus its chat thread.
     */
    // Allowed permissions: NONE — public, anonymous reporter endpoint (no staff role).
    // Why: the reporter proves who they are with their own 64-char access key, not a staff
    // permission; this is how an anonymous reporter reads their own case and thread.
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
     * Post a message (with optional evidence files) into a case's chat thread (reporter side).
     * Sent as multipart/form-data: the reporter's "accessKey", a "text" field, and zero or more
     * "files" parts.
     */
    // Allowed permissions: NONE — public, anonymous reporter endpoint (no staff role).
    // Why: this is the REPORTER's side of the two-way thread. They MUST authenticate with their
    // secret access key (which has to match the case id in the path) — a case id alone is not a
    // secret, so without the key anyone could inject messages into a confidential thread. The
    // sender label is fixed server-side to "Anonymous Whistleblower" and never taken from the
    // client, so a caller cannot impersonate a staff role.
    @PostMapping(value = "/{caseId}/messages", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<CaseMessage> postMessage(
            @PathVariable String caseId,
            @RequestParam("accessKey") String accessKey,
            @RequestParam(value = "text", required = false) String text,
            @RequestParam(value = "files", required = false) List<MultipartFile> files) {
        // Authenticate the reporter: the access key must resolve to THIS case.
        CaseReport report = caseReportService.resolveOwnedCase(accessKey, caseId);

        // Validate + store any attached files first (type/size/count checks live in the service).
        List<EvidenceAttachment> attachments = attachmentService.uploadAll(files);

        CaseMessage message = caseMessageService.postMessage(
                report.getId(),
                text,
                "Anonymous Whistleblower", // fixed server-side — never client-controlled
                report.getTenantId(),
                "Public Portal",
                "Anonymous Whistleblower",
                attachments
        );
        return ResponseEntity.ok(message);
    }

    /**
     * Download one file from the reporter's own case thread. The reporter proves ownership
     * with their access key (in the request body, never the URL). Lets a reporter retrieve a
     * document a case handler sent them, or re-download their own attachment.
     */
    // Allowed permissions: NONE — public, anonymous reporter endpoint (no staff role).
    // Why: the reporter's access key is their credential; the server re-checks it and only
    // returns a file that belongs to that same case.
    @PostMapping("/attachments/download")
    public ResponseEntity<byte[]> downloadAttachment(
            @Valid @RequestBody ReporterAttachmentRequest request) {
        // Resolve the case from the access key (throws if the key is wrong).
        CaseReport report = caseReportService.retrieveByAccessKey(request.getAccessKey());

        // The service checks the message really belongs to this case before returning the file.
        EvidenceAttachment attachment = caseMessageService.getMessageAttachment(
                report.getId(), request.getMessageId(), request.getAttachmentId(), report.getTenantId());

        byte[] fileBytes = attachmentService.getFile(attachment.getStorageVaultRef());

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + attachment.getDisplayName() + "\"")
                .body(fileBytes);
    }

    /**
     * Upload an evidence file for an existing case. Not used by the standard submit flow
     * (the form sends file metadata inside the submit request), but kept for clients that
     * upload the actual file later. Sent as multipart/form-data: the reporter's "accessKey"
     * and the "file".
     */
    // Allowed permissions: NONE — public, anonymous reporter endpoint (no staff role).
    // Why: it lets the reporter attach their own evidence to their OWN case. Ownership is proven
    // by the access key (which must match the case id in the path), not by knowing the id.
    @PostMapping(value = "/{caseId}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<EvidenceAttachment> uploadAttachment(
            @PathVariable String caseId,
            @RequestParam("accessKey") String accessKey,
            @RequestParam("file") MultipartFile file) {
        // Authenticate the reporter: the access key must resolve to THIS case.
        CaseReport report = caseReportService.resolveOwnedCase(accessKey, caseId);

        EvidenceAttachment attachment = attachmentService.upload(file);
        caseReportService.addAttachment(report.getId(), attachment, report.getTenantId());

        return ResponseEntity.ok(attachment);
    }
}
