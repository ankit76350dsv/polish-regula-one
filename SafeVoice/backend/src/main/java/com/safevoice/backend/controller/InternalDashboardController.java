package com.safevoice.backend.controller;

import com.safevoice.backend.dto.DashboardStatsResponse;
import com.safevoice.backend.service.DashboardService;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Internal (staff) endpoint that serves the dashboard's headline numbers.
 * Tenant-scoped via the X-Tenant-ID header, like the other internal endpoints.
 */
@RestController
@RequestMapping("/api/v1/internal/dashboard")
@RequiredArgsConstructor
public class InternalDashboardController {

    private final DashboardService dashboardService;

    /**
     * Returns the four dashboard stat-card values for the signed-in tenant:
     * open reports, unread replies, within-SLA percentage, and sealed audit entries.
     */
    @GetMapping("/stats")
    public ResponseEntity<DashboardStatsResponse> stats(
            @RequestHeader("X-Tenant-ID") String tenantId) {
        return ResponseEntity.ok(dashboardService.getStats(tenantId));
    }
}
