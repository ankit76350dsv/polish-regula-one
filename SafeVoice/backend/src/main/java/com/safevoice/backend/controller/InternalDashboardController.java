package com.safevoice.backend.controller;

import com.safevoice.backend.dto.CaseSummaryResponse;
import com.safevoice.backend.dto.DashboardStatsResponse;
import com.safevoice.backend.service.DashboardService;
import com.safevoice.backend.service.report.CaseReportService;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Internal (staff) endpoint that serves the dashboard's headline numbers.
 * Tenant-scoped via the X-Tenant-ID header, like the other internal endpoints.
 */
@RestController
@RequestMapping("/api/v1/internal/dashboard")
@RequiredArgsConstructor
public class InternalDashboardController {

    private final DashboardService dashboardService;
    private final CaseReportService caseReportService;

    /**
     * Returns the four dashboard stat-card values for the signed-in tenant:
     * open reports, unread replies, within-SLA percentage, and sealed audit entries.
     */
    // Allowed permissions: SAFEVOICE_ADMIN, SAFEVOICE_COMPLIANCE_OFFICER, SAFEVOICE_INVESTIGATOR,
    //                       SAFEVOICE_HR_MANAGER, SAFEVOICE_AUDITOR
    // Why: these are non-sensitive aggregate counts (open reports, unread, SLA %, audit total).
    // Any staff role that can see the workspace may see this operational summary.
    @GetMapping("/stats")
    public ResponseEntity<DashboardStatsResponse> stats(
            @RequestHeader("X-Tenant-ID") String tenantId) {
        return ResponseEntity.ok(dashboardService.getStats(tenantId));
    }

    /**
     * Returns the "cases needing attention" queue: active cases with NO investigator
     * assigned yet, newest first, as slim summaries. Drives the dashboard's priority queue.
     */
    // Allowed permissions: SAFEVOICE_ADMIN, SAFEVOICE_COMPLIANCE_OFFICER
    // Why: this is the assignment worklist (unassigned cases needing an owner). Only the roles
    // that can actually assign a case act on it, so per least privilege it is limited to them
    // rather than every view-only role.
    @GetMapping("/attention")
    public ResponseEntity<List<CaseSummaryResponse>> attention(
            @RequestHeader("X-Tenant-ID") String tenantId,
            @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(caseReportService.attentionCases(tenantId, limit));
    }
}
