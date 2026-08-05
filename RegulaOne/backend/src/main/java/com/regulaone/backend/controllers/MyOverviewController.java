package com.regulaone.backend.controllers;

import com.regulaone.backend.dto.AppResponse;
import com.regulaone.backend.dto.Dashboard.MyOverviewResponse;
import com.regulaone.backend.services.MyOverviewService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The personal "My Workspace" dashboard.
 *
 *   GET /api/me/overview
 *
 * Returns one snapshot of what the SIGNED-IN PERSON has to do across all six
 * modules — KSeFFlow, WorkPulse, SafeWork, SafeVoice, WasteSync and PrivacyPilot —
 * so the workspace screen makes a single call instead of six.
 *
 * It is the companion of {@code GET /api/admin/overview}: that one answers "is my
 * company compliant?" for a company administrator, this one answers "am I in
 * order?" for any member of a company.
 *
 * ── SECURITY ────────────────────────────────────────────────────────────────────
 *
 * * OPEN TO EVERY SIGNED-IN USER, and that is correct: the response contains only
 *   the caller's OWN records. A company administrator is also an employee with
 *   their own medical certificate and their own shifts, so they may use it too.
 *   {@code /api/me/**} is not one of the role-restricted prefixes in
 *   SecurityConfig, so it falls under "any request must be authenticated"; the
 *   {@code @PreAuthorize} below states that requirement in the code as well.
 *
 * * The person AND their company are derived from the verified session token, NOT
 *   from the URL. There is deliberately no {@code {userId}} or {@code {tenantId}}
 *   path variable: an id in the address bar invites someone to change it. The
 *   frontend route /company/{id}/overview may show a company id for readability,
 *   but the server ignores it entirely.
 *
 * * Read-only. Nothing here changes business data. The one write it triggers is an
 *   append-only audit entry recording who opened their workspace and which modules
 *   were returned (GDPR Art. 5(2) accountability).
 *
 * ── WHAT IT DOES NOT RETURN ─────────────────────────────────────────────────────
 *
 * No colleague's data, and no company totals. Every figure is the caller's own
 * count, hours or deadline. See {@link MyOverviewResponse} and each personal reader
 * for exactly what is excluded and why.
 */
@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class MyOverviewController {

    private final MyOverviewService myOverviewService;

    @GetMapping("/overview")
    public ResponseEntity<AppResponse<MyOverviewResponse>> getMyOverview(
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest request) {

        // jwt.getSubject() is the Cognito "sub" claim from the already-validated
        // token. It is the only identity input this endpoint accepts.
        MyOverviewResponse overview = myOverviewService.build(jwt.getSubject(), request);

        return ResponseEntity.ok(AppResponse.success("My workspace loaded", overview));
    }
}
