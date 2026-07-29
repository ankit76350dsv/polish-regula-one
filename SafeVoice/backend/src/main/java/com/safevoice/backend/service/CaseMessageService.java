package com.safevoice.backend.service;

import com.safevoice.backend.dto.CaseActivityEvent;
import com.safevoice.backend.model.document.CaseMessage;
import com.safevoice.backend.model.document.CaseReport;
import com.safevoice.backend.model.embedded.EncryptedPayload;
import com.safevoice.backend.model.embedded.EvidenceAttachment;
import com.safevoice.backend.model.embedded.TimelineEvent;
import com.safevoice.backend.model.enums.audit.AuditActionType;
import com.safevoice.backend.model.enums.audit.AuditOutcome;
import com.safevoice.backend.model.enums.case_report.CaseStatus;
import com.safevoice.backend.repository.CaseMessageRepository;
import com.safevoice.backend.repository.CaseReportRepository;
import com.safevoice.backend.service.report.CaseReportService;
import com.safevoice.backend.websocket.CaseEventPublisher;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * Service representing operations on CaseMessage chat channels.
 */
@Service
public class CaseMessageService {

    private final CaseMessageRepository caseMessageRepository;
    private final CaseReportRepository caseReportRepository;
    private final CaseReportService caseReportService;
    private final AuditLogService auditLogService;
    // Broadcasts the saved message live to anyone viewing the case.
    private final CaseEventPublisher caseEventPublisher;
    // Temporary only for local testing while running without AWS KMS. Keep false in production so
    // normal whistleblower plaintext messages are never accepted by default.
    @Value("${safevoice.allow-plaintext-intake-for-local-testing:false}")
    private boolean allowPlaintextIntakeForLocalTesting;
    // How long AFTER a case is closed the reporter may still post a final message. Staff are
    // blocked immediately on close; the reporter keeps this grace window (default 48 hours).
    @Value("${safevoice.reporter-post-close-window-hours:48}")
    private int reporterPostCloseWindowHours;

    @Autowired
    public CaseMessageService(
            CaseMessageRepository caseMessageRepository,
            CaseReportRepository caseReportRepository,
            CaseReportService caseReportService,
            AuditLogService auditLogService,
            CaseEventPublisher caseEventPublisher) {
        this.caseMessageRepository = caseMessageRepository;
        this.caseReportRepository = caseReportRepository;
        this.caseReportService = caseReportService;
        this.auditLogService = auditLogService;
        this.caseEventPublisher = caseEventPublisher;
    }

    /**
     * Post a new chat message inside a case channel.
     * Appends a timeline event and writes a MESSAGE_POSTED audit log.
     */
    public CaseMessage postMessage(
            String caseId,
            String text,
            EncryptedPayload encryptedText,
            String sender,
            String tenantId,
            String actorRole,
            String actorId,
            List<EvidenceAttachment> attachments) {

        if (tenantId == null || tenantId.trim().isEmpty()) {
            throw new IllegalArgumentException("Tenant ID context is required");
        }

        // A message must carry something: plain text, locked (encrypted) text, or at least one
        // file. This lets a reporter/handler send a file with no words, but blocks an empty message.
        boolean hasText = text != null && !text.trim().isEmpty();
        boolean hasEncrypted = encryptedText != null
                && encryptedText.getCiphertext() != null
                && !encryptedText.getCiphertext().isBlank();
        boolean hasFiles = attachments != null && !attachments.isEmpty();
        if (!hasText && !hasEncrypted && !hasFiles) {
            throw new IllegalArgumentException("A message must include text or at least one file");
        }

        // Verify parent case exists and belongs to the tenant
        CaseReport report = caseReportService.getById(caseId, tenantId);

        // Is the writer the reporter (not a staff handler)? The public app labels reporter
        // messages "Anonymous Whistleblower"; internal tools use "Reporter". Needed both for the
        // closed-case gate below and the read-flag bookkeeping later.
        boolean fromReporter = sender != null
                && (sender.equalsIgnoreCase("Reporter")
                    || sender.toLowerCase().contains("whistleblower"));

        // Closed-case rules:
        //  - STAFF can no longer post the moment a case is CLOSED (they must reopen to reply).
        //  - the REPORTER keeps a short grace window (default 48h from closure) to add a final
        //    message, then the thread locks for everyone too.
        //  - a CLOSED case with no recorded closedAt (legacy data) is treated as fully locked.
        // Callers get a 409 with a message they can show the user.
        if (report.getStatus() == CaseStatus.CLOSED) {
            boolean reporterWithinGrace = fromReporter
                    && report.getClosedAt() != null
                    && Instant.now().isBefore(
                            report.getClosedAt().plus(reporterPostCloseWindowHours, ChronoUnit.HOURS));
            if (!reporterWithinGrace) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        fromReporter
                                ? "This case is closed and the reply window has ended, so no new messages can be added."
                                : "This case is closed, so staff can no longer add messages. Reopen the case to reply.");
            }
        }

        // Decide how the words are stored, for EVERY case (HR grievances included now):
        //  - SYSTEM messages (e.g. the automatic 7-day acknowledgement): these are fixed,
        //    non-confidential notices generated by the server itself. There is no browser to
        //    lock them and no personal data to protect, so they are stored as plain text.
        //  - everything else: the words MUST arrive already locked in the sender's browser.
        //    Plain text is refused (unless the local-testing flag is on for dev). Files-only
        //    messages are always fine because a file has no readable words to leak here.
        boolean isSystem = "System".equalsIgnoreCase(sender);
        String storedText = null;
        EncryptedPayload storedEncrypted = null;
        if (isSystem) {
            storedText = text;
        } else if (hasEncrypted) {
            storedEncrypted = encryptedText;
        } else if (hasText && allowPlaintextIntakeForLocalTesting) {
            storedText = text; // local dev only
        } else if (hasText) {
            throw new IllegalArgumentException("Message text must be sent as client-side encrypted content.");
        }

        CaseMessage message = new CaseMessage();
        message.setTenantId(tenantId);
        message.setCaseId(caseId);
        message.setSender(sender);
        message.setText(storedText);
        message.setEncryptedText(storedEncrypted);
        message.setAttachments(attachments != null ? attachments : new ArrayList<>());
        message.setTimestamp(Instant.now());

        // Mark the message as already read by its own author (reporter vs staff computed above).
        if (fromReporter) {
            message.setReadByReporter(true);
            message.setReadByStaff(false);
        } else {
            message.setReadByReporter(false);
            message.setReadByStaff(true);
        }

        CaseMessage saved = caseMessageRepository.save(message);

        // Posting a reply means the sender has SEEN the whole conversation — so mark every
        // message in this case read for the sender's side and PERSIST it (staff reply → all
        // readByStaff; reporter reply → all readByReporter). This clears the other side's
        // messages from the sender's unread set durably, not just in the browser.
        markRead(caseId, tenantId, null, !fromReporter);

        // Append message event to parent case report timeline
        report.getTimeline().add(new TimelineEvent(
                new org.bson.types.ObjectId().toHexString(),
                "New Message",
                "Chat message posted by " + sender,
                Instant.now(),
                "message",
                sender
        ));
        caseReportRepository.save(report);

        // Record compliance audit log
        auditLogService.log(
                tenantId,
                sender,
                AuditActionType.MESSAGE_POSTED,
                caseId,
                AuditOutcome.RECORDED,
                null,
                saved.getId(),
                "Message posted inside case channel."
        );

        // Push the message live to anyone viewing this case (reporter + staff with it open).
        // Best-effort: the message is already saved, so a failed broadcast must not throw.
        caseEventPublisher.publishMessage(caseId, saved);

        // Also tell the whole tenant's staff that this case had activity, so their lists
        // reorder (most-recent first), unread badges update, and off-case staff get a
        // "new reply" notification — no matter which page they are on.
        caseEventPublisher.publishActivity(tenantId, CaseActivityEvent.builder()
                .caseId(caseId)
                .caseReference(report.getCaseReference())
                .sender(sender)
                .fromReporter(fromReporter)
                .at(saved.getTimestamp())
                .build());

        return saved;
    }

    /**
     * Mark messages read for ONE side of the thread and PERSIST it, so read/unread survives a
     * refresh and stays consistent across devices.
     *  - staffSide=true  → sets readByStaff  (a staff member opened the reporter's message)
     *  - staffSide=false → sets readByReporter (the reporter opened a staff message)
     * If messageId is given, only that one message is marked; otherwise the WHOLE thread is.
     * Tenant + case scoped, and idempotent (already-read messages are left as-is).
     */
    public void markRead(String caseId, String tenantId, String messageId, boolean staffSide) {
        // Tenant + case guard (throws if the case is not this tenant's).
        caseReportService.getById(caseId, tenantId);

        List<CaseMessage> messages;
        if (messageId != null && !messageId.isBlank()) {
            CaseMessage m = caseMessageRepository.findById(messageId).orElse(null);
            if (m == null || !tenantId.equals(m.getTenantId()) || !caseId.equals(m.getCaseId())) {
                throw new IllegalArgumentException("Message does not belong to this case");
            }
            messages = List.of(m);
        } else {
            messages = caseMessageRepository.findAllByTenantIdAndCaseIdOrderByTimestampAsc(tenantId, caseId);
        }

        List<CaseMessage> changed = new ArrayList<>();
        for (CaseMessage m : messages) {
            if (staffSide && !m.isReadByStaff()) {
                m.setReadByStaff(true);
                changed.add(m);
            } else if (!staffSide && !m.isReadByReporter()) {
                m.setReadByReporter(true);
                changed.add(m);
            }
        }
        if (!changed.isEmpty()) {
            caseMessageRepository.saveAll(changed);
        }
    }

    /**
     * Retrieves all chat messages for a case report.
     * Enforces tenant isolation.
     */
    public List<CaseMessage> getMessages(String caseId, String tenantId) {
        // Enforce validation by fetching case details first (triggers NoSuchElement if invalid/cross-tenant)
        caseReportService.getById(caseId, tenantId);
        return caseMessageRepository.findAllByTenantIdAndCaseIdOrderByTimestampAsc(tenantId, caseId);
    }

    /**
     * Find ONE attachment on ONE message of a case, after checking it really belongs to this
     * tenant and case. Used by the download endpoints so a caller can only ever reach a file
     * that is part of a case they are allowed to see. Throws if anything does not line up.
     */
    public EvidenceAttachment getMessageAttachment(
            String caseId, String messageId, String attachmentId, String tenantId) {
        // Tenant + case guard (throws if the case is not this tenant's).
        caseReportService.getById(caseId, tenantId);

        CaseMessage message = caseMessageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found"));

        // The message must belong to the SAME tenant and case as the request path.
        if (!tenantId.equals(message.getTenantId()) || !caseId.equals(message.getCaseId())) {
            throw new IllegalArgumentException("Message does not belong to this case");
        }

        return message.getAttachments().stream()
                .filter(a -> attachmentId.equals(a.getId()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Attachment not found in this message"));
    }
}
