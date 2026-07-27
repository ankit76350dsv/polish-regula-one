package com.privacypilot.backend.controller;

import com.privacypilot.backend.dto.AppResponse;
import com.privacypilot.backend.dto.notice.NoticeChecklistResponse;
import com.privacypilot.backend.dto.notice.NoticeGenerateRequest;
import com.privacypilot.backend.model.document.PrivacyNotice;
import com.privacypilot.backend.model.enums.notice.NoticeAudience;
import com.privacypilot.backend.security.AuthenticatedUser;
import com.privacypilot.backend.security.PrivacyPilotPermission;
import com.privacypilot.backend.service.AuditContext;
import com.privacypilot.backend.service.NoticeService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST API for privacy notices (klauzula informacyjna, Art. 13/14 GDPR).
 *
 * Auth & tenant: every method declares an {@link AuthenticatedUser} parameter, filled
 * from the RegulaOne session (401/403 if not signed in). The tenant is taken from that
 * verified session inside the service — never from the client. Each method opens with
 * {@code caller.requireAnyPermission(...)} to enforce least-privilege.
 *
 * Notices are VERSIONED history: "generate" always creates a NEW version and never
 * overwrites an old one, so there is no update or delete here. Responses use the shared
 * {@link AppResponse} envelope, exactly like the ROPA / DPIA / audit APIs.
 */
@RestController
@RequestMapping("/api/privacypilot/notices")
@RequiredArgsConstructor
public class NoticeController {

    private final NoticeService service;

    // Who may VIEW notices and the completeness checklist (everyone with a real role
    // except Employee — auditors and the DPO legitimately review published notices).
    private static final PrivacyPilotPermission[] CAN_VIEW = {
            PrivacyPilotPermission.PRIVACYPILOT_ADMIN,
            PrivacyPilotPermission.PRIVACYPILOT_COMPLIANCE_OFFICER,
            PrivacyPilotPermission.PRIVACYPILOT_DPO,
            PrivacyPilotPermission.PRIVACYPILOT_AUDITOR,
    };
    // Who may GENERATE a notice (day-to-day privacy management).
    private static final PrivacyPilotPermission[] CAN_GENERATE = {
            PrivacyPilotPermission.PRIVACYPILOT_ADMIN,
            PrivacyPilotPermission.PRIVACYPILOT_COMPLIANCE_OFFICER,
    };

    @GetMapping
    public AppResponse<List<PrivacyNotice>> list(AuthenticatedUser caller) {
        caller.requireAnyPermission(CAN_VIEW);
        return AppResponse.ok(service.list(caller));
    }

    @GetMapping("/{id}")
    public AppResponse<PrivacyNotice> get(AuthenticatedUser caller, @PathVariable String id) {
        caller.requireAnyPermission(CAN_VIEW);
        return AppResponse.ok(service.get(caller, id));
    }

    /**
     * The Art. 13/14 completeness check for one audience, computed from the register.
     * The audience is a code such as "employees" (unknown code → 400).
     */
    @GetMapping("/checklist")
    public AppResponse<NoticeChecklistResponse> checklist(
            AuthenticatedUser caller, @RequestParam String audience) {
        caller.requireAnyPermission(CAN_VIEW);
        return AppResponse.ok(service.checklist(caller, NoticeAudience.fromCode(audience)));
    }

    @PostMapping
    public ResponseEntity<AppResponse<PrivacyNotice>> generate(
            AuthenticatedUser caller,
            @Valid @RequestBody NoticeGenerateRequest request,
            HttpServletRequest http) {
        caller.requireAnyPermission(CAN_GENERATE);
        PrivacyNotice created = service.generate(caller, request, auditContext(caller, http));
        return ResponseEntity.status(HttpStatus.CREATED).body(AppResponse.ok(created, "Notice generated"));
    }

    // Build the audit "who/where" once from the verified caller + the HTTP request.
    private AuditContext auditContext(AuthenticatedUser caller, HttpServletRequest http) {
        return AuditContext.forCaller(caller, http.getRemoteAddr(), http.getHeader("User-Agent"));
    }
}
