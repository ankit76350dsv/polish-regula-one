package com.safevoice.backend.controller;

import com.safevoice.backend.dto.CaseKeysResponse;
import com.safevoice.backend.dto.DataKeyResponse;
import com.safevoice.backend.security.AuthenticatedUser;
import com.safevoice.backend.security.SafeVoicePermission;
import com.safevoice.backend.service.report.CaseReportService;

import lombok.RequiredArgsConstructor;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Crypto helpers for logged-in STAFF (investigators, compliance officers, admins).
 *
 * Staff need two things to work with encrypted cases:
 *   POST /api/v1/internal/crypto/data-key           → a one-time key to LOCK a reply they type
 *   GET  /api/v1/internal/crypto/case-keys/{caseId}  → the keys to READ (unlock) a case in-browser
 *
 * The organisation ALWAYS comes from the verified session ({@code caller.tenantId()}), never from
 * a client header or body, so a staff member can only ever make/read keys for their OWN
 * organisation. This enforces the multi-tenant isolation rule (CLAUDE.md §9).
 */
@RestController
@RequestMapping("/api/v1/internal/crypto")
@RequiredArgsConstructor
public class InternalCryptoController {

    private final CaseReportService caseReportService;

    /**
     * Give staff a one-time key to LOCK (encrypt) a reply before posting it to the thread. Bound
     * to the caller's own organisation from their session.
     */
    // Allowed permissions: SAFEVOICE_ADMIN, SAFEVOICE_COMPLIANCE_OFFICER, SAFEVOICE_INVESTIGATOR
    // Why: only the roles that may REPLY in a thread need a key to lock a reply. Read-only roles
    // (Auditor, HR Manager) do not post, so they do not mint encryption keys.
    @PostMapping("/data-key")
    public ResponseEntity<DataKeyResponse> dataKey(AuthenticatedUser caller) {
        caller.requireAnyPermission(
                SafeVoicePermission.SAFEVOICE_ADMIN,
                SafeVoicePermission.SAFEVOICE_COMPLIANCE_OFFICER,
                SafeVoicePermission.SAFEVOICE_INVESTIGATOR);
        DataKeyResponse response = caseReportService.issueDataKey(caller.tenantId());
        return ResponseEntity.ok(response);
    }

    /**
     * Give staff the keys to READ (unlock) one case in the browser — the main report plus every
     * message in its thread. The case must belong to the caller's own organisation.
     */
    // Allowed permissions: SAFEVOICE_ADMIN, SAFEVOICE_COMPLIANCE_OFFICER, SAFEVOICE_INVESTIGATOR,
    //                       SAFEVOICE_HR_MANAGER, SAFEVOICE_AUDITOR
    // Why: unlocking to READ a case is view access, which every SafeVoice role holds (the same
    // roles allowed to open a case and read its thread).
    @GetMapping("/case-keys/{caseId}")
    public ResponseEntity<CaseKeysResponse> caseKeys(
            @PathVariable String caseId,
            AuthenticatedUser caller) {
        caller.requireAnyPermission(
                SafeVoicePermission.SAFEVOICE_ADMIN,
                SafeVoicePermission.SAFEVOICE_COMPLIANCE_OFFICER,
                SafeVoicePermission.SAFEVOICE_INVESTIGATOR,
                SafeVoicePermission.SAFEVOICE_HR_MANAGER,
                SafeVoicePermission.SAFEVOICE_AUDITOR);
        CaseKeysResponse response = caseReportService.buildStaffCaseKeys(caseId, caller.tenantId());
        return ResponseEntity.ok(response);
    }
}
