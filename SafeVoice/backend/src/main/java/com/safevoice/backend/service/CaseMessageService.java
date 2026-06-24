package com.safevoice.backend.service;

import com.safevoice.backend.model.document.CaseMessage;
import com.safevoice.backend.model.document.CaseReport;
import com.safevoice.backend.model.embedded.TimelineEvent;
import com.safevoice.backend.model.enums.audit.AuditActionType;
import com.safevoice.backend.model.enums.audit.AuditOutcome;
import com.safevoice.backend.repository.CaseMessageRepository;
import com.safevoice.backend.repository.CaseReportRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Service representing operations on CaseMessage chat channels.
 */
@Service
public class CaseMessageService {

    private final CaseMessageRepository caseMessageRepository;
    private final CaseReportRepository caseReportRepository;
    private final CaseReportService caseReportService;
    private final AuditLogService auditLogService;

    @Autowired
    public CaseMessageService(
            CaseMessageRepository caseMessageRepository,
            CaseReportRepository caseReportRepository,
            CaseReportService caseReportService,
            AuditLogService auditLogService) {
        this.caseMessageRepository = caseMessageRepository;
        this.caseReportRepository = caseReportRepository;
        this.caseReportService = caseReportService;
        this.auditLogService = auditLogService;
    }

    /**
     * Post a new chat message inside a case channel.
     * Appends a timeline event and writes a MESSAGE_POSTED audit log.
     */
    public CaseMessage postMessage(
            String caseId,
            String text,
            String sender,
            String tenantId,
            String actorRole,
            String actorId) {

        if (tenantId == null || tenantId.trim().isEmpty()) {
            throw new IllegalArgumentException("Tenant ID context is required");
        }

        // Verify parent case exists and belongs to the tenant
        CaseReport report = caseReportService.getById(caseId, tenantId);

        CaseMessage message = new CaseMessage();
        message.setTenantId(tenantId);
        message.setCaseId(caseId);
        message.setSender(sender);
        message.setText(text);
        message.setTimestamp(Instant.now());

        if ("Reporter".equalsIgnoreCase(sender)) {
            message.setReadByReporter(true);
            message.setReadByAdmin(false);
        } else {
            message.setReadByReporter(false);
            message.setReadByAdmin(true);
        }

        CaseMessage saved = caseMessageRepository.save(message);

        // Append message event to parent case report timeline
        report.getTimeline().add(new TimelineEvent(
                new org.bson.types.ObjectId().toHexString(),
                "New Message",
                "Chat message posted by " + sender,
                Instant.now(),
                "message"
        ));
        caseReportRepository.save(report);

        // Record compliance audit log
        auditLogService.log(
                tenantId,
                actorRole,
                actorId,
                AuditActionType.MESSAGE_POSTED,
                caseId,
                AuditOutcome.RECORDED,
                null,
                saved.getId(),
                "Message posted inside case channel."
        );

        return saved;
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
}
