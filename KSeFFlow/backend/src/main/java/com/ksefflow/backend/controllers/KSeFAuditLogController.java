package com.ksefflow.backend.controllers;

import com.ksefflow.backend.models.KsefAuditLog;
import com.ksefflow.backend.security.AuthenticatedUser;
import com.ksefflow.backend.security.KsefPermission;
import com.ksefflow.backend.services.KSeFAuditLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

// Read-only audit log API used by the Enterprise Audit Center.
//
// Security contract:
//   - tenantId comes exclusively from the authenticated session (the idToken
//     cookie, verified via the RegulaOne backend) — never from a client header.
//   - Search and date-range filtering is done server-side — clients never
//     receive logs outside their own tenantId scope.
//   - No write endpoints are exposed: audit logs are immutable by design.
@RestController
@RequestMapping("/api/v1/audit-logs")
@RequiredArgsConstructor
@Slf4j
public class KSeFAuditLogController {

    private final KSeFAuditLogService auditLogService;

    /**
     * Returns a paginated list of audit log entries for the requesting tenant.
     *
     * Query parameters (all optional except pagination defaults):
     *   from    — ISO-8601 datetime lower bound   e.g. 2026-01-01T00:00:00
     *   to      — ISO-8601 datetime upper bound   e.g. 2026-12-31T23:59:59
     *   role    — exact role match                e.g. Accountant
     *   search  — case-insensitive substring match across email, action, IP, detail
     *   page    — zero-based page number          default 0
     *   size    — entries per page                default 20
     *   sort    — field,direction                 default timestamp,desc
     */
    // Permissions: KSEF_ADMIN (full access), KSEF_AUDITOR (read audit logs + export),
    //              KSEF_COMPLIANCE_OFFICER (oversight). Read-only — no write endpoint exists.
    @GetMapping
    public ResponseEntity<Page<KsefAuditLog>> listAuditLogs(
            AuthenticatedUser caller,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20) Pageable pageable) {

        // Read-only oversight — auditors, compliance officers, or the tenant admin.
        caller.requireAnyPermission(KsefPermission.KSEF_ADMIN,
                KsefPermission.KSEF_AUDITOR, KsefPermission.KSEF_COMPLIANCE_OFFICER);

        String tenantId = caller.tenantId();
        log.info("[listAuditLogs]:1 Audit log query: tenantId={} from={} to={} role={} search={}",
                tenantId, from, to, role, search != null ? "[present]" : null);

        Page<KsefAuditLog> page = auditLogService.listAuditLogs(
                tenantId, from, to, role, search, pageable);

        return ResponseEntity.ok(page);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<String> handleBadRequest(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(e.getMessage());
    }
}
