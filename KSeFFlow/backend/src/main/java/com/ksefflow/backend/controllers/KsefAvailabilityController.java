package com.ksefflow.backend.controllers;

import com.ksefflow.backend.security.AuthenticatedUser;
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

    // Body for the "declare a state" calls. reason is required so the decision is documented.
    public record DeclareRequest(String reason) {}

    // ── Read (any authenticated user) ────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<KsefAvailabilityService.Status> getStatus(AuthenticatedUser caller) {
        log.info("[getStatus]:1 GET /ksef-status — tenant={}", caller.tenantId());
        return ResponseEntity.ok(availabilityService.getStatus());
    }

    // ── Declare (admin only) ──────────────────────────────────────────────────────

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

    // Only ROLE_ADMIN (or higher) may change the KSeF state. Everyone else gets 403 Forbidden.
    private void requireAdmin(AuthenticatedUser caller) {
        String role = caller.role();
        boolean isAdmin = role != null && (role.contains("ADMIN") || role.contains("SUPER"));
        if (!isAdmin) {
            log.warn("[requireAdmin]:1 User [{}] (role [{}]) tried to change KSeF availability — denied",
                    caller.email(), role);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Only an administrator can change the KSeF availability state");
        }
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
