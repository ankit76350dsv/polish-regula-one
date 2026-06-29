package com.safevoice.backend.controller;

import com.safevoice.backend.model.document.AuditLog;
import com.safevoice.backend.service.AuditLogService;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Internal (staff) endpoint for reading the immutable, tamper-evident audit trail.
 * Tenant-scoped via the X-Tenant-ID header, like the other internal endpoints.
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
     * Returns the most recent audit entries for the signed-in tenant, newest first.
     *
     * @param limit how many rows to return (default 200, capped server-side)
     */
    @GetMapping
    public ResponseEntity<List<AuditLog>> list(
            @RequestHeader("X-Tenant-ID") String tenantId,
            @RequestParam(defaultValue = "200") int limit) {
        return ResponseEntity.ok(auditLogService.getRecent(tenantId, limit));
    }
}
