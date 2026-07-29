package com.privacypilot.backend.controller;

import com.privacypilot.backend.dto.AppResponse;
import com.privacypilot.backend.dto.dsar.DsarReasonRequest;
import com.privacypilot.backend.dto.dsar.DsarRequest;
import com.privacypilot.backend.model.document.Dsar;
import com.privacypilot.backend.security.AuthenticatedUser;
import com.privacypilot.backend.security.PrivacyPilotPermission;
import com.privacypilot.backend.service.AuditContext;
import com.privacypilot.backend.service.DsarService;
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
 * REST API for data-subject requests (DSAR — GDPR rights, Art. 15–22).
 *
 * Auth & tenant: every method declares an {@link AuthenticatedUser} parameter, filled
 * from the RegulaOne session (401/403 if not signed in). The tenant is taken from that
 * verified session inside the service — never from the client. Each method opens with
 * {@code caller.requireAnyPermission(...)} to enforce least-privilege.
 *
 * Intake and the day-to-day case work (verify identity, edit the task list, notes) go
 * through create/update. The three lifecycle steps that carry legal meaning are their
 * own guarded actions — extend the deadline (Art. 12(3)), complete, or refuse
 * (Art. 12(5)) — so the deadline and outcome are always set by the server, never faked
 * through an ordinary edit. There is intentionally NO delete: a DSAR is the record that
 * a right was handled on time.
 *
 * Responses use the shared {@link AppResponse} envelope, like the rest of the API.
 */
@RestController
@RequestMapping("/api/privacypilot/dsars")
@RequiredArgsConstructor
public class DsarController {

    private final DsarService service;

    // Who may VIEW the request queue (everyone with a real role except Employee).
    private static final PrivacyPilotPermission[] CAN_VIEW = {
            PrivacyPilotPermission.PRIVACYPILOT_ADMIN,
            PrivacyPilotPermission.PRIVACYPILOT_COMPLIANCE_OFFICER,
            PrivacyPilotPermission.PRIVACYPILOT_DPO,
            PrivacyPilotPermission.PRIVACYPILOT_AUDITOR,
    };
    // Who may handle requests (the MANAGE_DSAR capability — includes the DPO).
    private static final PrivacyPilotPermission[] CAN_EDIT = {
            PrivacyPilotPermission.PRIVACYPILOT_ADMIN,
            PrivacyPilotPermission.PRIVACYPILOT_COMPLIANCE_OFFICER,
            PrivacyPilotPermission.PRIVACYPILOT_DPO,
    };

    @GetMapping
    public AppResponse<List<Dsar>> list(AuthenticatedUser caller) {
        caller.requireAnyPermission(CAN_VIEW);
        return AppResponse.ok(service.list(caller));
    }

    @GetMapping("/{id}")
    public AppResponse<Dsar> get(AuthenticatedUser caller, @PathVariable String id) {
        caller.requireAnyPermission(CAN_VIEW);
        return AppResponse.ok(service.get(caller, id));
    }

    @PostMapping
    public ResponseEntity<AppResponse<Dsar>> create(
            AuthenticatedUser caller,
            @Valid @RequestBody DsarRequest request,
            HttpServletRequest http) {
        caller.requireAnyPermission(CAN_EDIT);
        Dsar created = service.create(caller, request, auditContext(caller, http));
        return ResponseEntity.status(HttpStatus.CREATED).body(AppResponse.ok(created, "Request recorded"));
    }

    @PutMapping("/{id}")
    public AppResponse<Dsar> update(
            AuthenticatedUser caller,
            @PathVariable String id,
            @Valid @RequestBody DsarRequest request,
            HttpServletRequest http) {
        caller.requireAnyPermission(CAN_EDIT);
        return AppResponse.ok(service.update(caller, id, request, auditContext(caller, http)), "Request updated");
    }

    /** Extend the deadline by two months (Art. 12(3)); reason is required. */
    @PostMapping("/{id}/extend")
    public AppResponse<Dsar> extend(
            AuthenticatedUser caller,
            @PathVariable String id,
            @Valid @RequestBody DsarReasonRequest request,
            HttpServletRequest http) {
        caller.requireAnyPermission(CAN_EDIT);
        return AppResponse.ok(service.extend(caller, id, request.getReason(), auditContext(caller, http)),
                "Deadline extended");
    }

    /** Mark the request completed (answered and closed). */
    @PostMapping("/{id}/complete")
    public AppResponse<Dsar> complete(
            AuthenticatedUser caller, @PathVariable String id, HttpServletRequest http) {
        caller.requireAnyPermission(CAN_EDIT);
        return AppResponse.ok(service.complete(caller, id, auditContext(caller, http)), "Request completed");
    }

    /** Refuse the request on a lawful ground (Art. 12(5)); reason is required. */
    @PostMapping("/{id}/refuse")
    public AppResponse<Dsar> refuse(
            AuthenticatedUser caller,
            @PathVariable String id,
            @Valid @RequestBody DsarReasonRequest request,
            HttpServletRequest http) {
        caller.requireAnyPermission(CAN_EDIT);
        return AppResponse.ok(service.refuse(caller, id, request.getReason(), auditContext(caller, http)),
                "Request refused");
    }

    // Build the audit "who/where" once from the verified caller + the HTTP request.
    private AuditContext auditContext(AuthenticatedUser caller, HttpServletRequest http) {
        return AuditContext.forCaller(caller, http.getRemoteAddr(), http.getHeader("User-Agent"));
    }
}
