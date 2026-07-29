package com.privacypilot.backend.controller;

import com.privacypilot.backend.dto.AppResponse;
import com.privacypilot.backend.dto.transfer.TransferRequest;
import com.privacypilot.backend.model.document.Transfer;
import com.privacypilot.backend.security.AuthenticatedUser;
import com.privacypilot.backend.security.PrivacyPilotPermission;
import com.privacypilot.backend.service.AuditContext;
import com.privacypilot.backend.service.TransferService;
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
 * REST API for third-country transfers (GDPR Chapter V — sending personal data
 * outside the EEA, with the safeguard that makes it lawful).
 *
 * Auth & tenant: every method declares an {@link AuthenticatedUser} parameter, filled
 * from the RegulaOne session (401/403 if not signed in). The tenant is taken from that
 * verified session inside the service — never from the client. Each method opens with
 * {@code caller.requireAnyPermission(...)} to enforce least-privilege.
 *
 * Responses use the shared {@link AppResponse} envelope, exactly like the ROPA / DPIA /
 * notice / vendor APIs.
 */
@RestController
@RequestMapping("/api/privacypilot/transfers")
@RequiredArgsConstructor
public class TransferController {

    private final TransferService service;

    // Who may VIEW the transfer register (everyone with a real role except Employee).
    private static final PrivacyPilotPermission[] CAN_VIEW = {
            PrivacyPilotPermission.PRIVACYPILOT_ADMIN,
            PrivacyPilotPermission.PRIVACYPILOT_COMPLIANCE_OFFICER,
            PrivacyPilotPermission.PRIVACYPILOT_DPO,
            PrivacyPilotPermission.PRIVACYPILOT_AUDITOR,
    };
    // Who may create/edit a transfer (the MANAGE_TRANSFERS capability).
    private static final PrivacyPilotPermission[] CAN_EDIT = {
            PrivacyPilotPermission.PRIVACYPILOT_ADMIN,
            PrivacyPilotPermission.PRIVACYPILOT_COMPLIANCE_OFFICER,
    };
    // Who may archive (delete) a transfer — restricted to Admin for a destructive action.
    private static final PrivacyPilotPermission[] CAN_DELETE = {
            PrivacyPilotPermission.PRIVACYPILOT_ADMIN,
    };

    @GetMapping
    public AppResponse<List<Transfer>> list(AuthenticatedUser caller) {
        caller.requireAnyPermission(CAN_VIEW);
        return AppResponse.ok(service.list(caller));
    }

    @GetMapping("/{id}")
    public AppResponse<Transfer> get(AuthenticatedUser caller, @PathVariable String id) {
        caller.requireAnyPermission(CAN_VIEW);
        return AppResponse.ok(service.get(caller, id));
    }

    @PostMapping
    public ResponseEntity<AppResponse<Transfer>> create(
            AuthenticatedUser caller,
            @Valid @RequestBody TransferRequest request,
            HttpServletRequest http) {
        caller.requireAnyPermission(CAN_EDIT);
        Transfer created = service.create(caller, request, auditContext(caller, http));
        return ResponseEntity.status(HttpStatus.CREATED).body(AppResponse.ok(created, "Transfer created"));
    }

    @PutMapping("/{id}")
    public AppResponse<Transfer> update(
            AuthenticatedUser caller,
            @PathVariable String id,
            @Valid @RequestBody TransferRequest request,
            HttpServletRequest http) {
        caller.requireAnyPermission(CAN_EDIT);
        return AppResponse.ok(service.update(caller, id, request, auditContext(caller, http)), "Transfer updated");
    }

    @DeleteMapping("/{id}")
    public AppResponse<Void> archive(
            AuthenticatedUser caller, @PathVariable String id, HttpServletRequest http) {
        caller.requireAnyPermission(CAN_DELETE);
        service.archive(caller, id, auditContext(caller, http));
        return AppResponse.ok(null, "Transfer archived");
    }

    // Build the audit "who/where" once from the verified caller + the HTTP request.
    private AuditContext auditContext(AuthenticatedUser caller, HttpServletRequest http) {
        return AuditContext.forCaller(caller, http.getRemoteAddr(), http.getHeader("User-Agent"));
    }
}
