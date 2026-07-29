package com.safevoice.backend.controller;

import com.safevoice.backend.dto.CaseKeysRequest;
import com.safevoice.backend.dto.CaseKeysResponse;
import com.safevoice.backend.dto.DataKeyRequest;
import com.safevoice.backend.dto.DataKeyResponse;
import com.safevoice.backend.service.report.CaseReportService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public, anonymous crypto helpers for whistleblowers (no login required).
 *
 * These are the SAFE replacement for the demo that put AWS keys in the browser. The browser
 * never gets an AWS password — it only ever talks to these two endpoints over TLS:
 *
 *   POST /api/safevoice/crypto/data-key   → get a one-time key to LOCK a report before sending it
 *   POST /api/safevoice/crypto/case-keys  → (reporter) get the keys to READ their own case
 *
 * Both are rate-limited per IP (see RateLimitFilter) because they cause the server to call AWS
 * KMS, and we do not want a stranger running up cost or brute-forcing access keys.
 */
@RestController
@RequestMapping("/api/safevoice/crypto")
@RequiredArgsConstructor
public class PublicCryptoController {

    private final CaseReportService caseReportService;

    /**
     * Give the browser a brand-new, one-time key to LOCK (encrypt) a report before it is sent.
     * The server checks the organisation is real and active first. Returns the plain key (used
     * once in the browser and then forgotten) and the wrapped key (safe to store with the data).
     */
    // Allowed permissions: NONE — public, anonymous reporter endpoint. A reporter has no account
    // and must be able to lock their report before it is ever submitted.
    @PostMapping("/data-key")
    public ResponseEntity<DataKeyResponse> dataKey(@Valid @RequestBody DataKeyRequest request) {
        DataKeyResponse response = caseReportService.issueDataKey(request.getTenantId());
        return ResponseEntity.ok(response);
    }

    /**
     * Give the REPORTER the keys to READ their own case in the browser. Ownership is proven by
     * the access key in the request body (never the URL). We only ever unwrap keys that belong
     * to the case that access key owns, so a stolen wrapped key cannot be unlocked here.
     */
    // Allowed permissions: NONE — public, anonymous reporter endpoint. The access key is the
    // reporter's credential; the server re-checks it and returns keys for that one case only.
    @PostMapping("/case-keys")
    public ResponseEntity<CaseKeysResponse> caseKeys(@Valid @RequestBody CaseKeysRequest request) {
        CaseKeysResponse response = caseReportService.buildReporterCaseKeys(request.getAccessKey());
        return ResponseEntity.ok(response);
    }
}
