package com.privacypilot.backend.controller;

import com.privacypilot.backend.dto.AppResponse;
import com.privacypilot.backend.dto.settings.SettingsRequest;
import com.privacypilot.backend.model.document.TenantSettings;
import com.privacypilot.backend.security.AuthenticatedUser;
import com.privacypilot.backend.security.PrivacyPilotPermission;
import com.privacypilot.backend.service.AuditContext;
import com.privacypilot.backend.service.TenantSettingsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST API for a company's PrivacyPilot settings — the company legal identity, the DPO
 * contact (and its Art. 10/11 designation tracking) and the AI preferences.
 *
 * There is ONE settings record per tenant, so this is a get-one / save-one API (no
 * list/create/delete). Auth & tenant come from the verified RegulaOne session.
 *
 * RBAC split:
 *   - VIEW is broad, because the register header, every privacy notice, the breach
 *     report and the AI on/off check all READ these settings — so Admin, Compliance
 *     Officer, DPO and Auditor can read them.
 *   - EDIT is Admin-only (the EDIT_SETTINGS capability): company identity and the DPO
 *     designation are sensitive, tenant-wide facts.
 */
@RestController
@RequestMapping("/api/privacypilot/settings")
@RequiredArgsConstructor
public class SettingsController {

    private final TenantSettingsService service;

    // Everyone with a real PrivacyPilot role may READ settings (needed by notices,
    // the register header, the breach report and the AI toggle check).
    private static final PrivacyPilotPermission[] CAN_VIEW = {
            PrivacyPilotPermission.PRIVACYPILOT_ADMIN,
            PrivacyPilotPermission.PRIVACYPILOT_COMPLIANCE_OFFICER,
            PrivacyPilotPermission.PRIVACYPILOT_DPO,
            PrivacyPilotPermission.PRIVACYPILOT_AUDITOR,
    };
    // Only the Company Admin may CHANGE them (the EDIT_SETTINGS capability).
    private static final PrivacyPilotPermission[] CAN_EDIT = {
            PrivacyPilotPermission.PRIVACYPILOT_ADMIN,
    };

    /** The caller's company settings (a blank, unsaved object if none exist yet). */
    @GetMapping
    public AppResponse<TenantSettings> get(AuthenticatedUser caller) {
        caller.requireAnyPermission(CAN_VIEW);
        return AppResponse.ok(service.get(caller));
    }

    /** Save the company settings (creates the row on first save). */
    @PutMapping
    public AppResponse<TenantSettings> update(
            AuthenticatedUser caller,
            @Valid @RequestBody SettingsRequest request,
            HttpServletRequest http) {
        caller.requireAnyPermission(CAN_EDIT);
        return AppResponse.ok(service.update(caller, request, auditContext(caller, http)), "Settings saved");
    }

    // Build the audit "who/where" once from the verified caller + the HTTP request.
    private AuditContext auditContext(AuthenticatedUser caller, HttpServletRequest http) {
        return AuditContext.forCaller(caller, http.getRemoteAddr(), http.getHeader("User-Agent"));
    }
}
