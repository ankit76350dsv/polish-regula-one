package com.privacypilot.backend.controller;

import com.privacypilot.backend.dto.AppResponse;
import com.privacypilot.backend.dto.dashboard.DashboardResponse;
import com.privacypilot.backend.security.AuthenticatedUser;
import com.privacypilot.backend.security.PrivacyPilotPermission;
import com.privacypilot.backend.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST API for the compliance dashboard — one read-only summary of the caller's company.
 *
 * There is a single endpoint (GET) that returns all the dashboard numbers at once, so the
 * screen makes one call instead of pulling every register into the browser. Auth & tenant
 * come from the verified RegulaOne session; the client never says which company it is.
 *
 * RBAC: reading is allowed for every real PrivacyPilot role (Admin, Compliance Officer,
 * DPO, Auditor) — the dashboard only shows counts and deadlines, nothing sensitive.
 */
@RestController
@RequestMapping("/api/privacypilot/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService service;

    // Everyone with a real PrivacyPilot role may READ the dashboard.
    private static final PrivacyPilotPermission[] CAN_VIEW = {
            PrivacyPilotPermission.PRIVACYPILOT_ADMIN,
            PrivacyPilotPermission.PRIVACYPILOT_COMPLIANCE_OFFICER,
            PrivacyPilotPermission.PRIVACYPILOT_DPO,
            PrivacyPilotPermission.PRIVACYPILOT_AUDITOR,
    };

    /** The dashboard summary for the caller's company. */
    @GetMapping
    public AppResponse<DashboardResponse> get(AuthenticatedUser caller) {
        caller.requireAnyPermission(CAN_VIEW);
        return AppResponse.ok(service.build(caller));
    }
}
