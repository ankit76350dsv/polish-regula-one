package com.privacypilot.backend.controller;

import com.privacypilot.backend.dto.AppResponse;
import com.privacypilot.backend.dto.vendor.VendorRequest;
import com.privacypilot.backend.model.document.Vendor;
import com.privacypilot.backend.security.AuthenticatedUser;
import com.privacypilot.backend.security.PrivacyPilotPermission;
import com.privacypilot.backend.service.AuditContext;
import com.privacypilot.backend.service.VendorService;
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
 * REST API for processors / sub-processors (Art. 28 GDPR vendors and their DPAs).
 *
 * Auth & tenant: every method declares an {@link AuthenticatedUser} parameter, filled
 * from the RegulaOne session (401/403 if not signed in). The tenant is taken from that
 * verified session inside the service — never from the client. Each method opens with
 * {@code caller.requireAnyPermission(...)} to enforce least-privilege.
 *
 * Responses use the shared {@link AppResponse} envelope, exactly like the ROPA / DPIA /
 * notice APIs.
 */
@RestController
@RequestMapping("/api/privacypilot/vendors")
@RequiredArgsConstructor
public class VendorController {

    private final VendorService service;

    // Who may VIEW the processor list (everyone with a real role except Employee).
    private static final PrivacyPilotPermission[] CAN_VIEW = {
            PrivacyPilotPermission.PRIVACYPILOT_ADMIN,
            PrivacyPilotPermission.PRIVACYPILOT_COMPLIANCE_OFFICER,
            PrivacyPilotPermission.PRIVACYPILOT_DPO,
            PrivacyPilotPermission.PRIVACYPILOT_AUDITOR,
    };
    // Who may create/edit a processor (the MANAGE_VENDORS capability).
    private static final PrivacyPilotPermission[] CAN_EDIT = {
            PrivacyPilotPermission.PRIVACYPILOT_ADMIN,
            PrivacyPilotPermission.PRIVACYPILOT_COMPLIANCE_OFFICER,
    };
    // Who may archive (delete) a processor — restricted to Admin for a destructive action.
    private static final PrivacyPilotPermission[] CAN_DELETE = {
            PrivacyPilotPermission.PRIVACYPILOT_ADMIN,
    };

    @GetMapping
    public AppResponse<List<Vendor>> list(AuthenticatedUser caller) {
        caller.requireAnyPermission(CAN_VIEW);
        return AppResponse.ok(service.list(caller));
    }

    @GetMapping("/{id}")
    public AppResponse<Vendor> get(AuthenticatedUser caller, @PathVariable String id) {
        caller.requireAnyPermission(CAN_VIEW);
        return AppResponse.ok(service.get(caller, id));
    }

    @PostMapping
    public ResponseEntity<AppResponse<Vendor>> create(
            AuthenticatedUser caller,
            @Valid @RequestBody VendorRequest request,
            HttpServletRequest http) {
        caller.requireAnyPermission(CAN_EDIT);
        Vendor created = service.create(caller, request, auditContext(caller, http));
        return ResponseEntity.status(HttpStatus.CREATED).body(AppResponse.ok(created, "Processor created"));
    }

    @PutMapping("/{id}")
    public AppResponse<Vendor> update(
            AuthenticatedUser caller,
            @PathVariable String id,
            @Valid @RequestBody VendorRequest request,
            HttpServletRequest http) {
        caller.requireAnyPermission(CAN_EDIT);
        return AppResponse.ok(service.update(caller, id, request, auditContext(caller, http)), "Processor updated");
    }

    @DeleteMapping("/{id}")
    public AppResponse<Void> archive(
            AuthenticatedUser caller, @PathVariable String id, HttpServletRequest http) {
        caller.requireAnyPermission(CAN_DELETE);
        service.archive(caller, id, auditContext(caller, http));
        return AppResponse.ok(null, "Processor archived");
    }

    // Build the audit "who/where" once from the verified caller + the HTTP request.
    private AuditContext auditContext(AuthenticatedUser caller, HttpServletRequest http) {
        return AuditContext.forCaller(caller, http.getRemoteAddr(), http.getHeader("User-Agent"));
    }
}
