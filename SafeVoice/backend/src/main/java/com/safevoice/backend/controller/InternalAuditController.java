package com.safevoice.backend.controller;

import com.safevoice.backend.dto.PageResponse;
import com.safevoice.backend.model.document.AuditLog;
import com.safevoice.backend.security.AuthenticatedUser;
import com.safevoice.backend.security.SafeVoicePermission;
import com.safevoice.backend.service.AuditLogService;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Internal (staff) endpoint for reading the immutable, tamper-evident audit trail.
 * Tenant-scoped from the verified session ({@link AuthenticatedUser#tenantId()}), never a
 * client header, and gated with {@code caller.requireAnyPermission(...)}.
 *
 * Read-only by design: there is NO create/update/delete here. Audit entries are written
 * only as a side effect of real actions (through AuditLogService.log), never by hand, so
 * the trail stays trustworthy for compliance.
 */
@RestController
@RequestMapping("/api/v1/internal/audit")
@RequiredArgsConstructor
public class InternalAuditController {

    private final AuditLogService auditLogService;

    /**
     * Returns ONE PAGE of the signed-in tenant's audit trail, newest first.
     *
     * Query parameters (all optional, with safe defaults):
     *   page        1-based page number (default 1)
     *   size        rows per page (default 20, capped server-side)
     *   search      free text across actor, action, subject, outcome, notice
     *   actionType  keep only this action (e.g. MESSAGE_POSTED)
     *   outcome     keep only this outcome (e.g. RECORDED)
     *   subjectId   keep only entries about this subject (e.g. one case id)
     *   from        only entries at/after this date or date-time
     *   to          only entries on/before this date (inclusive of the whole day)
     */
    // Allowed permissions: SAFEVOICE_ADMIN, SAFEVOICE_COMPLIANCE_OFFICER, SAFEVOICE_AUDITOR
    // Why: the immutable audit trail is a compliance/oversight record, so it is limited to the
    // roles that hold audit access. Investigators and HR managers do case work but are not
    // granted oversight of the whole tenant's activity log.
    @GetMapping
    public ResponseEntity<PageResponse<AuditLog>> list(
            AuthenticatedUser caller,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String actionType,
            @RequestParam(required = false) String outcome,
            @RequestParam(required = false) String subjectId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        caller.requireAnyPermission(
                SafeVoicePermission.SAFEVOICE_ADMIN,
                SafeVoicePermission.SAFEVOICE_COMPLIANCE_OFFICER,
                SafeVoicePermission.SAFEVOICE_AUDITOR);
        PageResponse<AuditLog> logs = auditLogService.search(
                caller.tenantId(), search, actionType, outcome, subjectId, from, to, page, size);
        return ResponseEntity.ok(logs);
    }
}
