package com.privacypilot.backend.controller;

import com.privacypilot.backend.dto.AppResponse;
import com.privacypilot.backend.dto.audit.AuditEntryResponse;
import com.privacypilot.backend.model.enums.audit.AuditAction;
import com.privacypilot.backend.model.enums.audit.AuditEntityType;
import com.privacypilot.backend.security.AuthenticatedUser;
import com.privacypilot.backend.security.PrivacyPilotPermission;
import com.privacypilot.backend.service.AuditQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.List;

/**
 * REST API for the immutable audit trail (WHO did WHAT, to WHICH record, WHEN, from
 * WHERE, with the BEFORE/AFTER values). Backs the "Audit trail" screen and lets an
 * auditor investigate the history of any record.
 *
 * READ-ONLY BY DESIGN: there is intentionally NO create/update/delete here. Audit
 * lines are write-once legal evidence (kept 10 years) and are written ONLY inside the
 * server by {@code AuditService} when a real change happens — never by an outside call.
 *
 * Auth & tenant: like every PrivacyPilot endpoint, each method takes an
 * {@link AuthenticatedUser} (401/403 if not signed in), and the tenant comes from that
 * verified session inside the service — never from the client — so one company can only
 * ever read its own trail. Viewing the trail is limited to the roles that hold the
 * "view audit trail" capability (Admin, Compliance Officer, DPO, Auditor).
 *
 * Responses use the shared {@link AppResponse} envelope, exactly like the rest of the API.
 */
@RestController
@RequestMapping("/api/privacypilot/audit")
@RequiredArgsConstructor
public class AuditController {

    private final AuditQueryService service;

    // Who may READ the audit trail. Mirrors the frontend RBAC matrix (VIEW_AUDIT_TRAIL):
    // everyone with real oversight — but NOT plain employees, who see no audit data.
    private static final PrivacyPilotPermission[] CAN_VIEW_AUDIT = {
            PrivacyPilotPermission.PRIVACYPILOT_ADMIN,
            PrivacyPilotPermission.PRIVACYPILOT_COMPLIANCE_OFFICER,
            PrivacyPilotPermission.PRIVACYPILOT_DPO,
            PrivacyPilotPermission.PRIVACYPILOT_AUDITOR,
    };

    /**
     * List audit entries for the caller's company, newest first. Every filter is
     * OPTIONAL — with none, it returns the whole (capped) trail:
     *   - entityType : only one kind of record, e.g. "activity", "breach"
     *   - entityId   : the full history of one specific record
     *   - action     : only one action, e.g. "UPDATE", "APPROVE"
     *   - q          : free-text over actor name / record label / action
     *   - from / to  : an ISO-8601 time range (e.g. 2026-01-01T00:00:00Z)
     *   - limit      : max rows (capped server-side)
     */
    @GetMapping
    public AppResponse<List<AuditEntryResponse>> list(
            AuthenticatedUser caller,
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String entityId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) Integer limit) {
        caller.requireAnyPermission(CAN_VIEW_AUDIT);

        // Convert the string query params into typed filters. An unknown enum code or a
        // malformed date is a client mistake → a clean 400, never a 500.
        AuditEntityType type = parseEntityType(entityType);
        AuditAction act = parseAction(action);
        Instant fromTs = parseInstant(from, "from");
        Instant toTs = parseInstant(to, "to");

        return AppResponse.ok(service.list(caller, type, entityId, act, q, fromTs, toTs, limit));
    }

    /** One audit entry by id, only if it belongs to the caller's company (else 404). */
    @GetMapping("/{id}")
    public AppResponse<AuditEntryResponse> get(AuthenticatedUser caller, @PathVariable String id) {
        caller.requireAnyPermission(CAN_VIEW_AUDIT);
        return AppResponse.ok(service.get(caller, id));
    }

    // ── Param parsing helpers (turn client strings into typed filters, or 400) ──────

    // Uses the enum's own fromCode so BOTH the code ("activity") and the name
    // ("ACTIVITY") are accepted, case-insensitively; an unknown value throws
    // IllegalArgumentException, which the global handler maps to 400.
    private static AuditEntityType parseEntityType(String raw) {
        return (raw == null || raw.isBlank()) ? null : AuditEntityType.fromCode(raw);
    }

    private static AuditAction parseAction(String raw) {
        return (raw == null || raw.isBlank()) ? null : AuditAction.fromCode(raw);
    }

    // Parse an ISO-8601 instant, turning a bad value into a clear 400 (instead of the
    // 500 an unhandled DateTimeParseException would cause).
    private static Instant parseInstant(String raw, String field) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(raw.trim());
        } catch (DateTimeParseException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid '" + field + "' date — use ISO-8601, e.g. 2026-01-01T00:00:00Z");
        }
    }
}
