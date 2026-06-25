package com.ksefflow.backend.controllers;

import com.ksefflow.backend.security.AuthenticatedUser;
import com.ksefflow.backend.security.KsefPermission;
import com.ksefflow.backend.services.KSeFAuditLogService;
import com.ksefflow.backend.services.KsefAvailabilityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

// REST API for the KSeF availability / failure-mode state (C7).
//
// Anyone signed in can READ the current state (the UI shows a banner when KSeF is down).
// Only an ADMIN can CHANGE it, because declaring an emergency is a legal decision based on
// the official Ministry of Finance announcement — it changes the deadline by which offline
// invoices must reach KSeF.
@RestController
@RequestMapping("/api/v1/ksef-status")
@RequiredArgsConstructor
@Slf4j
public class KsefAvailabilityController {

    private final KsefAvailabilityService availabilityService;
    private final com.ksefflow.backend.config.KsefApiProperties apiProperties;

    // Body for the "declare a state" calls. reason is required so the decision is documented.
    public record DeclareRequest(String reason) {}

    // Read-only connection info shown on the Integration page: which KSeF environment we target,
    // the actual base URL, and the invoice schema. Non-sensitive (no keys/tokens) — real config.
    public record ConnectionInfo(String environment, String baseUrl, String invoiceSchema) {}

    // ── Read (any authenticated user) ────────────────────────────────────────────

    // Permissions: any KSeF role (KSEF_TENANT_ADMIN, KSEF_CASE_MANAGER,
    //              KSEF_COMPLIANCE_OFFICER, KSEF_AUDITOR, KSEF_EMPLOYEE) — read-only status.
    @GetMapping
    public ResponseEntity<KsefAvailabilityService.Status> getStatus(AuthenticatedUser caller) {
        log.info("[getStatus]:1 GET /ksef-status — tenant={}", caller.tenantId());
        return ResponseEntity.ok(availabilityService.getStatus());
    }

    // The real KSeF connection the backend uses (environment + active base URL + schema).
    @GetMapping("/connection")
    public ResponseEntity<ConnectionInfo> getConnection(AuthenticatedUser caller) {
        String schema = apiProperties.getFormCode().getSystemCode()
                + " " + apiProperties.getFormCode().getSchemaVersion();
        return ResponseEntity.ok(new ConnectionInfo(
                apiProperties.getEnvironment().name(),
                apiProperties.getActiveBaseUrl(),
                schema));
    }

    // ── Declare (admin only) ──────────────────────────────────────────────────────

    // Permissions: KSEF_TENANT_ADMIN only — declaring an emergency is a legal decision
    //              that changes invoice deadlines, so no other role may do it.
    // Declare a Ministry-announced emergency ("tryb awaryjny") — 7-business-day window.
    @PostMapping("/emergency")
    public ResponseEntity<KsefAvailabilityService.Status> declareEmergency(
            AuthenticatedUser caller, @RequestBody DeclareRequest request) {
        requireAdmin(caller);
        String reason = safeReason(request);
        KsefAvailabilityService.Status status = availabilityService.declareEmergency(reason, caller.email());
        audit(caller, "KSEF_EMERGENCY_DECLARED", reason);
        return ResponseEntity.ok(status);
    }

    // Permissions: KSEF_TENANT_ADMIN only — same reason as /emergency.
    // Manually declare unavailability (e.g. a known maintenance window) — next-business-day window.
    @PostMapping("/unavailability")
    public ResponseEntity<KsefAvailabilityService.Status> declareUnavailability(
            AuthenticatedUser caller, @RequestBody DeclareRequest request) {
        requireAdmin(caller);
        String reason = safeReason(request);
        KsefAvailabilityService.Status status = availabilityService.declareUnavailability(reason, caller.email());
        audit(caller, "KSEF_UNAVAILABILITY_DECLARED", reason);
        return ResponseEntity.ok(status);
    }

    // Permissions: KSEF_TENANT_ADMIN only — clearing a declaration is also admin-only.
    // Clear any manual declaration and let the automatic monitor take over again.
    @PostMapping("/online")
    public ResponseEntity<KsefAvailabilityService.Status> declareOnline(
            AuthenticatedUser caller, @RequestBody(required = false) DeclareRequest request) {
        requireAdmin(caller);
        String reason = request != null ? safeReason(request) : "Cleared by admin";
        KsefAvailabilityService.Status status = availabilityService.declareOnline(reason, caller.email());
        audit(caller, "KSEF_ONLINE_DECLARED", reason);
        return ResponseEntity.ok(status);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────────

    // Only a KSEF_TENANT_ADMIN may change the KSeF state. Everyone else gets 403 Forbidden.
    private void requireAdmin(AuthenticatedUser caller) {
        caller.requireAnyPermission(KsefPermission.KSEF_TENANT_ADMIN);
    }

    private static String safeReason(DeclareRequest request) {
        if (request == null || request.reason() == null || request.reason().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A reason is required");
        }
        return request.reason().trim();
    }

    // Records an immutable, platform-level audit entry (tenantId "SYSTEM" — this is a global state).
    private void audit(AuthenticatedUser caller, String action, String reason) {
        KSeFAuditLogService.writeAuditLog("SYSTEM", action, null, null,
                "reason=" + reason, caller.email(), null);
    }
}
