package com.privacypilot.backend.controller;

import com.privacypilot.backend.dto.AppResponse;
import com.privacypilot.backend.dto.activity.ActivityRequest;
import com.privacypilot.backend.model.document.ProcessingActivity;
import com.privacypilot.backend.security.AuthenticatedUser;
import com.privacypilot.backend.security.PrivacyPilotPermission;
import com.privacypilot.backend.service.AuditContext;
import com.privacypilot.backend.service.ProcessingActivityService;
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
 * REST API for the ROPA register (Art. 30 GDPR).
 *
 * Auth & tenant: every method declares an {@link AuthenticatedUser} parameter, which
 * the argument resolver fills from the RegulaOne session (401/403 if not signed in).
 * The tenant is taken from that verified session inside the service — never from the
 * client. Each method opens with {@code caller.requireAnyPermission(...)} to enforce
 * least-privilege (mirrors the frontend RBAC matrix, expressed as permission codes).
 *
 * Responses use the shared {@link AppResponse} envelope so the frontend unwraps them
 * exactly like the RegulaOne auth responses.
 */
@RestController
@RequestMapping("/api/privacypilot/activities")
@RequiredArgsConstructor
public class ProcessingActivityController {

    private final ProcessingActivityService service;

    // Roles that may VIEW the register (everyone with a real PrivacyPilot role except Employee).
    private static final PrivacyPilotPermission[] CAN_VIEW = {
            PrivacyPilotPermission.PRIVACYPILOT_ADMIN,
            PrivacyPilotPermission.PRIVACYPILOT_COMPLIANCE_OFFICER,
            PrivacyPilotPermission.PRIVACYPILOT_DPO,
            PrivacyPilotPermission.PRIVACYPILOT_AUDITOR,
    };
    // Roles that may create/edit an activity.
    private static final PrivacyPilotPermission[] CAN_EDIT = {
            PrivacyPilotPermission.PRIVACYPILOT_ADMIN,
            PrivacyPilotPermission.PRIVACYPILOT_COMPLIANCE_OFFICER,
    };
    // Roles that may approve an activity (sign-off is admin/DPO only).
    private static final PrivacyPilotPermission[] CAN_APPROVE = {
            PrivacyPilotPermission.PRIVACYPILOT_ADMIN,
            PrivacyPilotPermission.PRIVACYPILOT_DPO,
    };
    // Roles that may archive (delete) an activity.
    private static final PrivacyPilotPermission[] CAN_DELETE = {
            PrivacyPilotPermission.PRIVACYPILOT_ADMIN,
    };

    @GetMapping
    public AppResponse<List<ProcessingActivity>> list(AuthenticatedUser caller) {
        caller.requireAnyPermission(CAN_VIEW);
        return AppResponse.ok(service.list(caller));
    }

    @GetMapping("/{id}")
    public AppResponse<ProcessingActivity> get(AuthenticatedUser caller, @PathVariable String id) {
        caller.requireAnyPermission(CAN_VIEW);
        return AppResponse.ok(service.get(caller, id));
    }

    @PostMapping
    public ResponseEntity<AppResponse<ProcessingActivity>> create(
            AuthenticatedUser caller,
            @Valid @RequestBody ActivityRequest request,
            HttpServletRequest http) {
        caller.requireAnyPermission(CAN_EDIT);
        ProcessingActivity created = service.create(caller, request, auditContext(caller, http));
        return ResponseEntity.status(HttpStatus.CREATED).body(AppResponse.ok(created, "Activity created"));
    }

    @PutMapping("/{id}")
    public AppResponse<ProcessingActivity> update(
            AuthenticatedUser caller,
            @PathVariable String id,
            @Valid @RequestBody ActivityRequest request,
            HttpServletRequest http) {
        caller.requireAnyPermission(CAN_EDIT);
        return AppResponse.ok(service.update(caller, id, request, auditContext(caller, http)), "Activity updated");
    }

    @PostMapping("/{id}/approve")
    public AppResponse<ProcessingActivity> approve(
            AuthenticatedUser caller, @PathVariable String id, HttpServletRequest http) {
        caller.requireAnyPermission(CAN_APPROVE);
        return AppResponse.ok(service.approve(caller, id, auditContext(caller, http)), "Activity approved");
    }

    @DeleteMapping("/{id}")
    public AppResponse<Void> archive(
            AuthenticatedUser caller, @PathVariable String id, HttpServletRequest http) {
        caller.requireAnyPermission(CAN_DELETE);
        service.archive(caller, id, auditContext(caller, http));
        return AppResponse.ok(null, "Activity archived");
    }

    // Build the audit "who/where" once from the verified caller + the HTTP request.
    private AuditContext auditContext(AuthenticatedUser caller, HttpServletRequest http) {
        return AuditContext.forCaller(caller, http.getRemoteAddr(), http.getHeader("User-Agent"));
    }
}
