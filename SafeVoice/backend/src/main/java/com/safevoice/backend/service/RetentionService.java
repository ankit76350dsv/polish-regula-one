package com.safevoice.backend.service;

import com.safevoice.backend.model.document.CaseMessage;
import com.safevoice.backend.model.document.CaseReport;
import com.safevoice.backend.model.embedded.EvidenceAttachment;
import com.safevoice.backend.model.enums.audit.AuditActionType;
import com.safevoice.backend.model.enums.audit.AuditOutcome;
import com.safevoice.backend.model.enums.retention.RetentionState;
import com.safevoice.backend.repository.CaseMessageRepository;
import com.safevoice.backend.repository.CaseReportRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

/**
 * Enforces the data-retention lifecycle (GDPR Art. 5(1)(e) storage limitation + Art. 17,
 * EU Whistleblower Directive Art. 18, CLAUDE.md §16).
 *
 * A scheduled job runs on a cron and destroys cases whose retention period has expired: it
 * deletes the evidence files from S3, permanently strips the personal data from the case and
 * its thread, marks the case DESTROYED, and records an immutable audit entry. Cases on
 * LEGAL_HOLD are never touched — a hold suspends automatic deletion until it is lifted.
 *
 * "Destroy" here means anonymise-in-place: we keep a minimal, PII-free case shell (id, tenant,
 * category, dates, retention state) for lawful statistics and the audit chain, and remove
 * everything that could identify or expose the reporter (description, contact reference, the
 * access-key hash, and all attachments + messages).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RetentionService {

    private final CaseReportRepository caseReportRepository;
    private final CaseMessageRepository caseMessageRepository;
    private final AttachmentService attachmentService;
    private final AuditLogService auditLogService;

    /**
     * Destroy every case that has passed its retention deadline and is not on legal hold.
     * Runs on the configured cron (default 03:00 daily). Each case is handled independently so
     * one failure never aborts the whole run.
     */
    @Scheduled(cron = "${safevoice.retention.purge-cron:0 0 3 * * *}")
    public void purgeExpiredCases() {
        Instant now = Instant.now();
        List<CaseReport> due = caseReportRepository.findDueForDeletion(now);
        if (due.isEmpty()) {
            return;
        }
        log.info("[RetentionService] Retention run: {} case(s) past their retention deadline.", due.size());
        int destroyed = 0;
        for (CaseReport report : due) {
            try {
                destroy(report, now);
                destroyed++;
            } catch (Exception e) {
                // Never abort the whole run for one bad case; log and move on.
                log.error("[RetentionService] Failed to destroy case {} : {}", report.getId(), e.getMessage());
            }
        }
        log.info("[RetentionService] Retention run complete: {}/{} case(s) destroyed.", destroyed, due.size());
    }

    // Anonymise-in-place: purge S3 files, delete thread messages, strip PII, mark DESTROYED,
    // and write the audit entry. Runs per case.
    private void destroy(CaseReport report, Instant now) {
        // 1. Delete every evidence file from S3 — the case's own attachments and the thread's.
        for (EvidenceAttachment a : report.getAttachments()) {
            attachmentService.delete(a.getStorageVaultRef());
        }
        List<CaseMessage> messages = caseMessageRepository
                .findAllByTenantIdAndCaseIdOrderByTimestampAsc(report.getTenantId(), report.getId());
        for (CaseMessage m : messages) {
            for (EvidenceAttachment a : m.getAttachments()) {
                attachmentService.delete(a.getStorageVaultRef());
            }
        }
        // 2. Delete the thread messages (they hold encrypted reporter/handler content).
        if (!messages.isEmpty()) {
            caseMessageRepository.deleteAll(messages);
        }

        // 3. Strip personal data from the case shell.
        report.setDescription(null);      // encrypted free-text narrative
        report.setContactVaultRef(null);  // encrypted contact reference
        report.setDepartment(null);       // free-text location/area (can identify)
        report.getAttachments().clear();
        report.setKeyHash(null);          // credential fingerprint — case can no longer be tracked
        report.setHashedPin(null);

        // 4. Mark destroyed + soft-delete.
        report.getRetention().setState(RetentionState.DESTROYED);
        report.setDeleted(true);
        report.setDeletedAt(now);
        caseReportRepository.save(report);

        // 5. Immutable audit entry (no PII — just the case id and the reason).
        auditLogService.log(
                report.getTenantId(),
                "System",
                "Retention Job",
                AuditActionType.RETENTION_UPDATED,
                report.getId(),
                AuditOutcome.RECORDED,
                "ACTIVE",
                "DESTROYED",
                "Case data anonymised and destroyed after the " + report.getRetention().getRetentionYears()
                        + "-year retention period; evidence files purged from storage."
        );
        log.info("[RetentionService] Case {} destroyed after retention period.", report.getId());
    }
}
