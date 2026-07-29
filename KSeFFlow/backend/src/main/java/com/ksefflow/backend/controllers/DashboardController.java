package com.ksefflow.backend.controllers;

import com.ksefflow.backend.dto.DashboardSummaryResponse;
import com.ksefflow.backend.security.AuthenticatedUser;
import com.ksefflow.backend.security.KsefPermission;
import com.ksefflow.backend.services.DashboardService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// REST API for the KSeFFlow dashboard.
//
// One read-only endpoint returns all dashboard figures in a single call (counts, money totals,
// certificate health, KSeF status, recent activity) — so the frontend avoids many round-trips.
// The tenant is always taken from the verified caller (never a client header) → tenant isolation.
@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
@Slf4j
public class DashboardController {

    private final DashboardService dashboardService;

    // Permissions: read access — KSEF_ADMIN, KSEF_CASE_MANAGER, KSEF_COMPLIANCE_OFFICER,
    //              KSEF_AUDITOR (the same roles allowed to read invoices). The dashboard only shows
    //              aggregate, read-only figures for the caller's own tenant.
    @GetMapping("/summary")
    public ResponseEntity<DashboardSummaryResponse> getSummary(AuthenticatedUser caller) {
        caller.requireAnyPermission(KsefPermission.KSEF_ADMIN, KsefPermission.KSEF_CASE_MANAGER,
                KsefPermission.KSEF_COMPLIANCE_OFFICER, KsefPermission.KSEF_AUDITOR);
        log.info("[getSummary]:1 GET /dashboard/summary — tenant={}", caller.tenantId());
        return ResponseEntity.ok(dashboardService.getSummary(caller.tenantId()));
    }
}
