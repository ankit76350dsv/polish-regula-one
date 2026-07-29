package com.privacypilot.backend.controller;

import com.privacypilot.backend.dto.AppResponse;
import com.privacypilot.backend.dto.audit.AuditEntryResponse;
import com.privacypilot.backend.dto.export.ExportRequest;
import com.privacypilot.backend.security.AuthenticatedUser;
import com.privacypilot.backend.security.PrivacyPilotPermission;
import com.privacypilot.backend.service.AuditContext;
import com.privacypilot.backend.service.ExportService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import static com.privacypilot.backend.security.PrivacyPilotPermission.PRIVACYPILOT_ADMIN;
import static com.privacypilot.backend.security.PrivacyPilotPermission.PRIVACYPILOT_AUDITOR;
import static com.privacypilot.backend.security.PrivacyPilotPermission.PRIVACYPILOT_COMPLIANCE_OFFICER;
import static com.privacypilot.backend.security.PrivacyPilotPermission.PRIVACYPILOT_DPO;

/**
 * REST API for recording that data was taken OUT of PrivacyPilot — a file download, a
 * print view, or a copy to the clipboard.
 *
 * The browser calls this BEFORE it produces the file, and only produces it if this call
 * succeeds. That is what puts an EXPORT line in the audit trail for every copy that leaves
 * the app (GDPR Art. 5(2) accountability) — see {@link ExportService} for the full "why".
 *
 * WRITE-ONLY BY DESIGN: there is no GET/PUT/DELETE here. An export line is write-once legal
 * evidence, read back through the audit-trail API like every other entry, and never edited.
 *
 * Auth & tenant: like every PrivacyPilot endpoint, the method takes an
 * {@link AuthenticatedUser} (401/403 if not signed in) and the company comes from that
 * verified session — never from the request.
 */
@RestController
@RequestMapping("/api/privacypilot/exports")
@RequiredArgsConstructor
public class ExportController {

    private final ExportService service;

    /**
     * Who may record an export. These are exactly the roles that hold the frontend's
     * EXPORT_DATA capability, and exactly the roles allowed to READ the registers in the
     * first place — an Employee, who can see none of this data, can never claim to have
     * exported it.
     */
    private static final PrivacyPilotPermission[] CAN_EXPORT = {
            PRIVACYPILOT_ADMIN,
            PRIVACYPILOT_COMPLIANCE_OFFICER,
            PRIVACYPILOT_DPO,
            PRIVACYPILOT_AUDITOR,
    };

    /**
     * Record one export and return the audit line that was written, as a receipt the
     * browser can show or log. 201 Created — this call creates a permanent record.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AppResponse<AuditEntryResponse> record(
            AuthenticatedUser caller,
            @Valid @RequestBody ExportRequest request,
            HttpServletRequest http) {
        caller.requireAnyPermission(CAN_EXPORT);
        return AppResponse.ok(
                AuditEntryResponse.from(service.record(caller, request, auditContext(caller, http))),
                "Export recorded");
    }

    // Build the audit "who/where" once from the verified caller + the HTTP request.
    private AuditContext auditContext(AuthenticatedUser caller, HttpServletRequest http) {
        return AuditContext.forCaller(caller, http.getRemoteAddr(), http.getHeader("User-Agent"));
    }
}
