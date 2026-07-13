package com.safevoice.backend.service.jobs;

import com.safevoice.backend.model.document.CaseReport;
import com.safevoice.backend.model.embedded.TimelineEvent;
import com.safevoice.backend.model.enums.audit.AuditActionType;
import com.safevoice.backend.model.enums.audit.AuditOutcome;
import com.safevoice.backend.model.enums.case_report.CaseStatus;
import com.safevoice.backend.repository.CaseReportRepository;
import com.safevoice.backend.service.AuditLogService;
import com.safevoice.backend.service.CaseMessageService;
import com.safevoice.backend.service.notification.SafeVoiceEmailNotificationService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Enforces the whistleblower response deadlines (EU Directive Art. 9(1)(b)/(f), Polish Act):
 *   • a 7-day ACKNOWLEDGEMENT of receipt to the reporter, and
 *   • the 3-month FEEDBACK deadline.
 *
 * The dates were already stored on each case; this adds the missing ENFORCEMENT:
 *   1. autoAcknowledge — posts an automatic acknowledgement into the reporter's thread for any
 *      still-unacknowledged case, so the 7-day duty is always met even if staff forget.
 *   2. escalateFeedbackDeadlines — flags open cases nearing/over the 3-month feedback deadline,
 *      records it, and emails the tenant's staff (once per case).
 *
 * Both run as scheduled jobs and write to the immutable audit trail.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ComplianceDeadlineService {

    private static final String ACKNOWLEDGEMENT_MESSAGE = """
            Your report has been received and registered. This is an automatic confirmation that a \
            designated case handler will review it in confidence.

            You can return to this page at any time with your access key to see updates or add more \
            information. In line with the law, we aim to provide feedback on the outcome within three \
            months.""";

    private static final String FEEDBACK_RISK_FLAG = "Feedback deadline approaching";

    private final CaseReportRepository caseReportRepository;
    private final CaseMessageService caseMessageService;
    private final AuditLogService auditLogService;
    private final SafeVoiceEmailNotificationService emailNotificationService;

    // Escalate a case this many days BEFORE its feedback deadline (also catches overdue cases).
    @Value("${safevoice.compliance.feedback-escalation-lead-days:14}")
    private int feedbackEscalationLeadDays;

    /**
     * Send the automatic 7-day acknowledgement to the reporter for any case still awaiting it
     * (status RECEIVED). Runs hourly, so a reporter gets confirmation promptly and always well
     * within the legal 7-day window. Each case is handled independently.
     */
    @Scheduled(cron = "${safevoice.compliance.acknowledgement-cron:0 0 * * * *}")
    public void autoAcknowledge() {
        List<CaseReport> pending = caseReportRepository.findByStatusAndDeletedFalse(CaseStatus.RECEIVED);
        if (pending.isEmpty()) {
            return;
        }
        int acknowledged = 0;
        for (CaseReport report : pending) {
            try {
                acknowledge(report);
                acknowledged++;
            } catch (Exception e) {
                log.error("[ComplianceDeadline] failed to acknowledge case {}: {}", report.getId(), e.getMessage());
            }
        }
        log.info("[ComplianceDeadline] auto-acknowledged {}/{} pending case(s).", acknowledged, pending.size());
    }

    private void acknowledge(CaseReport report) {
        Instant now = Instant.now();
        // Move to ACKNOWLEDGED first (and record it) so the message post below re-reads this state.
        report.setStatus(CaseStatus.ACKNOWLEDGED);
        report.getTimeline().add(new TimelineEvent(
                new ObjectId().toHexString(),
                "Acknowledged",
                "Automatic acknowledgement sent to the reporter within the 7-day deadline.",
                now,
                "system"));
        caseReportRepository.save(report);

        // Post the acknowledgement into the reporter's thread — they see it on the tracking page.
        // This also writes a MESSAGE_POSTED audit entry and notifies over WebSocket.
        caseMessageService.postMessage(
                report.getId(),
                ACKNOWLEDGEMENT_MESSAGE,
                null, // no encrypted payload: this is a fixed, non-confidential system notice
                "System",
                report.getTenantId(),
                "System",
                "Compliance Job",
                List.of());

        auditLogService.log(
                report.getTenantId(),
                "System",
                "Compliance Job",
                AuditActionType.CASE_STATUS_CHANGED,
                report.getId(),
                AuditOutcome.RECORDED,
                CaseStatus.RECEIVED.name(),
                CaseStatus.ACKNOWLEDGED.name(),
                "Automatic 7-day acknowledgement sent to the reporter.");
    }

    /**
     * Flag open cases that are at or within the lead window of their 3-month feedback deadline,
     * record the escalation on each case, and email the tenant's staff (once per tenant per run).
     * Each case is escalated only once (feedbackEscalated flag). Runs daily.
     */
    @Scheduled(cron = "${safevoice.compliance.escalation-cron:0 30 2 * * *}")
    public void escalateFeedbackDeadlines() {
        Instant threshold = Instant.now().plus(feedbackEscalationLeadDays, ChronoUnit.DAYS);
        List<CaseReport> due = caseReportRepository.findFeedbackDeadlineDue(threshold);
        if (due.isEmpty()) {
            return;
        }
        Set<String> tenantsToNotify = new HashSet<>();
        for (CaseReport report : due) {
            try {
                escalate(report);
                tenantsToNotify.add(report.getTenantId());
            } catch (Exception e) {
                log.error("[ComplianceDeadline] failed to escalate case {}: {}", report.getId(), e.getMessage());
            }
        }
        // One content-free email per tenant that had at least one case escalated this run.
        tenantsToNotify.forEach(emailNotificationService::notifyFeedbackDeadline);
        log.info("[ComplianceDeadline] escalated {} case(s) across {} tenant(s) for the feedback deadline.",
                due.size(), tenantsToNotify.size());
    }

    private void escalate(CaseReport report) {
        report.setFeedbackEscalated(true);
        if (!report.getRiskFlags().contains(FEEDBACK_RISK_FLAG)) {
            report.getRiskFlags().add(FEEDBACK_RISK_FLAG);
        }
        report.getTimeline().add(new TimelineEvent(
                new ObjectId().toHexString(),
                "Feedback deadline",
                "The 3-month feedback deadline is approaching or has passed; escalated to staff.",
                Instant.now(),
                "system"));
        caseReportRepository.save(report);

        auditLogService.log(
                report.getTenantId(),
                "System",
                "Compliance Job",
                AuditActionType.DEADLINE_ESCALATED,
                report.getId(),
                AuditOutcome.RECORDED,
                null,
                null,
                "Case approaching or over its 3-month feedback deadline; staff notified.");
    }
}
