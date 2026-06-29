package com.safevoice.backend.service;

import com.safevoice.backend.dto.DashboardStatsResponse;
import com.safevoice.backend.model.enums.case_report.CaseStatus;
import com.safevoice.backend.repository.AuditLogRepository;
import com.safevoice.backend.repository.CaseMessageRepository;
import com.safevoice.backend.repository.CaseReportRepository;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;

/**
 * Builds the small set of headline numbers for the staff dashboard.
 *
 * Each number is a single COUNT query against the database, scoped to the tenant, so
 * the figures are correct across all of that organisation's data (not just the page of
 * rows the browser happens to hold). No case content is read — only counts — so nothing
 * sensitive is touched.
 */
@Service
@RequiredArgsConstructor
public class DashboardService {

    private final CaseReportRepository caseReportRepository;
    private final CaseMessageRepository caseMessageRepository;
    private final AuditLogRepository auditLogRepository;

    /**
     * Compute the four dashboard figures for one organisation.
     *
     * @param tenantId the organisation to summarise (required)
     */
    public DashboardStatsResponse getStats(String tenantId) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new IllegalArgumentException("Tenant info/context is required");
        }

        // "Open reports": active cases that are not closed.
        long open = caseReportRepository
                .countByTenantIdAndDeletedFalseAndStatusNot(tenantId, CaseStatus.CLOSED);

        // Open cases whose 3-month feedback deadline has already passed = SLA breaches.
        long breached = caseReportRepository
                .countByTenantIdAndDeletedFalseAndStatusNotAndFeedbackDueBefore(
                        tenantId, CaseStatus.CLOSED, Instant.now());

        // "Within SLA": share of open cases still inside their deadline. With no open
        // cases nothing can be late, so we report a clean 100%.
        int slaPercent = open == 0
                ? 100
                : (int) Math.round(((double) (open - breached) / open) * 100);

        // "Unread replies": reporter messages staff have not opened yet.
        long unread = caseMessageRepository.countByTenantIdAndReadByAdminFalse(tenantId);

        // "Audit entries sealed": total tamper-evident audit-trail rows for the tenant.
        long audit = auditLogRepository.countByTenantId(tenantId);

        return DashboardStatsResponse.builder()
                .openReports(open)
                .unreadReplies(unread)
                .slaCompliancePercent(slaPercent)
                .auditEntries(audit)
                .build();
    }
}
