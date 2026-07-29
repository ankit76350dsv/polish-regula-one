package com.privacypilot.backend.controller;

import com.privacypilot.backend.dto.AppResponse;
import com.privacypilot.backend.dto.breach.BreachRequest;
import com.privacypilot.backend.model.document.Breach;
import com.privacypilot.backend.security.AuthenticatedUser;
import com.privacypilot.backend.security.PrivacyPilotPermission;
import com.privacypilot.backend.service.AuditContext;
import com.privacypilot.backend.service.BreachService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST API for personal-data breach cases (Art. 33–34 GDPR).
 *
 * Auth & tenant: every method declares an {@link AuthenticatedUser} parameter, filled
 * from the RegulaOne session (401/403 if not signed in). The tenant is taken from that
 * verified session inside the service — never from the client. Each method opens with
 * {@code caller.requireAnyPermission(...)} to enforce least-privilege.
 *
 * There is intentionally NO delete: a breach is accountability evidence that must be
 * kept even when it is not reported (Art. 33(5)). "Telling UODO" and "telling the
 * affected people" are their own guarded actions, so those moments are always
 * server-stamped and can never be faked through an ordinary edit.
 *
 * Responses use the shared {@link AppResponse} envelope, like the rest of the API.
 */
@RestController
@RequestMapping("/api/privacypilot/breaches")
@RequiredArgsConstructor
public class BreachController {

    private final BreachService service;

    // Who may VIEW the breach register (everyone with a real role except Employee).
    private static final PrivacyPilotPermission[] CAN_VIEW = {
            PrivacyPilotPermission.PRIVACYPILOT_ADMIN,
            PrivacyPilotPermission.PRIVACYPILOT_COMPLIANCE_OFFICER,
            PrivacyPilotPermission.PRIVACYPILOT_DPO,
            PrivacyPilotPermission.PRIVACYPILOT_AUDITOR,
    };
    // Who may record / handle breaches (the MANAGE_BREACHES capability — includes the
    // DPO, who leads breach response).
    private static final PrivacyPilotPermission[] CAN_EDIT = {
            PrivacyPilotPermission.PRIVACYPILOT_ADMIN,
            PrivacyPilotPermission.PRIVACYPILOT_COMPLIANCE_OFFICER,
            PrivacyPilotPermission.PRIVACYPILOT_DPO,
    };

    @GetMapping
    public AppResponse<List<Breach>> list(AuthenticatedUser caller) {
        caller.requireAnyPermission(CAN_VIEW);
        return AppResponse.ok(service.list(caller));
    }

    @GetMapping("/{id}")
    public AppResponse<Breach> get(AuthenticatedUser caller, @PathVariable String id) {
        caller.requireAnyPermission(CAN_VIEW);
        return AppResponse.ok(service.get(caller, id));
    }

    @PostMapping
    public ResponseEntity<AppResponse<Breach>> create(
            AuthenticatedUser caller,
            @Valid @RequestBody BreachRequest request,
            HttpServletRequest http) {
        caller.requireAnyPermission(CAN_EDIT);
        Breach created = service.create(caller, request, auditContext(caller, http));
        return ResponseEntity.status(HttpStatus.CREATED).body(AppResponse.ok(created, "Breach recorded"));
    }

    @PutMapping("/{id}")
    public AppResponse<Breach> update(
            AuthenticatedUser caller,
            @PathVariable String id,
            @Valid @RequestBody BreachRequest request,
            HttpServletRequest http) {
        caller.requireAnyPermission(CAN_EDIT);
        return AppResponse.ok(service.update(caller, id, request, auditContext(caller, http)), "Breach updated");
    }

    /** Record that UODO has now been notified (server stamps the moment). */
    @PostMapping("/{id}/notify-uodo")
    public AppResponse<Breach> notifyUodo(
            AuthenticatedUser caller, @PathVariable String id, HttpServletRequest http) {
        caller.requireAnyPermission(CAN_EDIT);
        return AppResponse.ok(service.markUodoNotified(caller, id, auditContext(caller, http)),
                "Marked as notified to UODO");
    }

    /** Record that the affected people have now been told directly (Art. 34). */
    @PostMapping("/{id}/notify-subjects")
    public AppResponse<Breach> notifySubjects(
            AuthenticatedUser caller, @PathVariable String id, HttpServletRequest http) {
        caller.requireAnyPermission(CAN_EDIT);
        return AppResponse.ok(service.markSubjectsNotified(caller, id, auditContext(caller, http)),
                "Marked data subjects as notified");
    }

    // Build the audit "who/where" once from the verified caller + the HTTP request.
    private AuditContext auditContext(AuthenticatedUser caller, HttpServletRequest http) {
        return AuditContext.forCaller(caller, http.getRemoteAddr(), http.getHeader("User-Agent"));
    }
}
