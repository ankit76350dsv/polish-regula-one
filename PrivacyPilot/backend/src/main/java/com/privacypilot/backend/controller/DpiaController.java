package com.privacypilot.backend.controller;

import com.privacypilot.backend.dto.AppResponse;
import com.privacypilot.backend.dto.dpia.DpiaCreateRequest;
import com.privacypilot.backend.dto.dpia.DpiaUpdateRequest;
import com.privacypilot.backend.model.document.Dpia;
import com.privacypilot.backend.security.AuthenticatedUser;
import com.privacypilot.backend.security.PrivacyPilotPermission;
import com.privacypilot.backend.service.AuditContext;
import com.privacypilot.backend.service.DpiaService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST API for DPIAs (Data Protection Impact Assessments, Art. 35 GDPR).
 *
 * Auth & tenant: every method declares an {@link AuthenticatedUser} parameter, which
 * the argument resolver fills from the RegulaOne session (401/403 if not signed in).
 * The tenant is taken from that verified session inside the service — never from the
 * client. Each method opens with {@code caller.requireAnyPermission(...)} to enforce
 * least-privilege (mirrors the frontend RBAC matrix, expressed as permission codes).
 *
 * A DPIA is always about ONE processing activity, so it is created FROM an activity
 * (the body carries only that activity id) and links back to it. Sign-off is a
 * separate, guarded action ({@code POST /{id}/sign}) — never settable via create/edit.
 *
 * Responses use the shared {@link AppResponse} envelope so the frontend unwraps them
 * exactly like the ROPA and audit responses.
 */
@RestController
@RequestMapping("/api/privacypilot/dpias")
@RequiredArgsConstructor
public class DpiaController {

    private final DpiaService service;

    // Roles that may VIEW DPIAs (everyone with a real PrivacyPilot role except Employee).
    private static final PrivacyPilotPermission[] CAN_VIEW = {
            PrivacyPilotPermission.PRIVACYPILOT_ADMIN,
            PrivacyPilotPermission.PRIVACYPILOT_COMPLIANCE_OFFICER,
            PrivacyPilotPermission.PRIVACYPILOT_DPO,
            PrivacyPilotPermission.PRIVACYPILOT_AUDITOR,
    };
    // Roles that may create/edit a DPIA (day-to-day management).
    private static final PrivacyPilotPermission[] CAN_EDIT = {
            PrivacyPilotPermission.PRIVACYPILOT_ADMIN,
            PrivacyPilotPermission.PRIVACYPILOT_COMPLIANCE_OFFICER,
    };
    // Roles that may SIGN a DPIA sign-off line. The service further checks that the
    // caller holds the SPECIFIC line's role (a DPO signs the DPO line, an Admin the
    // Admin line — separation of duties).
    private static final PrivacyPilotPermission[] CAN_SIGN = {
            PrivacyPilotPermission.PRIVACYPILOT_ADMIN,
            PrivacyPilotPermission.PRIVACYPILOT_DPO,
    };
    // Roles that may archive (soft-delete) a DPIA.
    private static final PrivacyPilotPermission[] CAN_DELETE = {
            PrivacyPilotPermission.PRIVACYPILOT_ADMIN,
    };

    @GetMapping
    public AppResponse<List<Dpia>> list(AuthenticatedUser caller) {
        caller.requireAnyPermission(CAN_VIEW);
        return AppResponse.ok(service.list(caller));
    }

    @GetMapping("/{id}")
    public AppResponse<Dpia> get(AuthenticatedUser caller, @PathVariable String id) {
        caller.requireAnyPermission(CAN_VIEW);
        return AppResponse.ok(service.get(caller, id));
    }

    @PostMapping
    public ResponseEntity<AppResponse<Dpia>> create(
            AuthenticatedUser caller,
            @Valid @RequestBody DpiaCreateRequest request,
            HttpServletRequest http) {
        caller.requireAnyPermission(CAN_EDIT);
        Dpia created = service.createForActivity(caller, request.getActivityId(), auditContext(caller, http));
        return ResponseEntity.status(HttpStatus.CREATED).body(AppResponse.ok(created, "DPIA created"));
    }

    @PutMapping("/{id}")
    public AppResponse<Dpia> update(
            AuthenticatedUser caller,
            @PathVariable String id,
            @Valid @RequestBody DpiaUpdateRequest request,
            HttpServletRequest http) {
        caller.requireAnyPermission(CAN_EDIT);
        return AppResponse.ok(service.update(caller, id, request, auditContext(caller, http)), "DPIA updated");
    }

    @PostMapping("/{id}/sign")
    public AppResponse<Dpia> sign(
            AuthenticatedUser caller, @PathVariable String id, HttpServletRequest http) {
        caller.requireAnyPermission(CAN_SIGN);
        return AppResponse.ok(service.sign(caller, id, auditContext(caller, http)), "DPIA signed");
    }

    @DeleteMapping("/{id}")
    public AppResponse<Void> archive(
            AuthenticatedUser caller, @PathVariable String id, HttpServletRequest http) {
        caller.requireAnyPermission(CAN_DELETE);
        service.archive(caller, id, auditContext(caller, http));
        return AppResponse.ok(null, "DPIA archived");
    }

    // Build the audit "who/where" once from the verified caller + the HTTP request.
    private AuditContext auditContext(AuthenticatedUser caller, HttpServletRequest http) {
        return AuditContext.forCaller(caller, http.getRemoteAddr(), http.getHeader("User-Agent"));
    }
}
