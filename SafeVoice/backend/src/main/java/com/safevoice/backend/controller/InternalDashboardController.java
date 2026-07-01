package com.safevoice.backend.controller;

import com.safevoice.backend.dto.CaseSummaryResponse;
import com.safevoice.backend.dto.DashboardStatsResponse;
import com.safevoice.backend.security.AuthenticatedUser;
import com.safevoice.backend.security.SafeVoicePermission;
import com.safevoice.backend.service.DashboardService;
import com.safevoice.backend.service.report.CaseReportService;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Internal (staff) endpoint that serves the dashboard's headline numbers.
 *
 * Tenant-scoped from the verified session ({@link AuthenticatedUser#tenantId()}), never a
 * client header, and gated per action with {@code caller.requireAnyPermission(...)}.
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
    public ResponseEntity<DashboardStatsResponse> stats(AuthenticatedUser caller) {
        caller.requireAnyPermission(
                SafeVoicePermission.SAFEVOICE_ADMIN,
                SafeVoicePermission.SAFEVOICE_COMPLIANCE_OFFICER,
                SafeVoicePermission.SAFEVOICE_INVESTIGATOR,
                SafeVoicePermission.SAFEVOICE_HR_MANAGER,
                SafeVoicePermission.SAFEVOICE_AUDITOR);
        return ResponseEntity.ok(dashboardService.getStats(caller.tenantId()));
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
            AuthenticatedUser caller,
            @RequestParam(defaultValue = "20") int limit) {
        caller.requireAnyPermission(
                SafeVoicePermission.SAFEVOICE_ADMIN,
                SafeVoicePermission.SAFEVOICE_COMPLIANCE_OFFICER);
        return ResponseEntity.ok(caseReportService.attentionCases(caller.tenantId(), limit));
    }
}
