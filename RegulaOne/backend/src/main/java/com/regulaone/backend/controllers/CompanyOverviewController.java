package com.regulaone.backend.controllers;

import com.regulaone.backend.dto.AppResponse;
import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse;
import com.regulaone.backend.services.CompanyOverviewService;
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
 * The company-admin compliance dashboard.
 *
 *   GET /api/admin/overview
 *
 * Returns one snapshot of the company's compliance position across all six
 * modules — KSeFFlow, WorkPulse, SafeWork, SafeVoice, WasteSync and PrivacyPilot —
 * so the dashboard screen makes a single call instead of six.
 *
 * ── SECURITY ────────────────────────────────────────────────────────────────────
 *
 * * Route sits under {@code /api/admin/**}, which SecurityConfig already limits to
 *   ROLE_ADMIN. The {@code @PreAuthorize} below states the same rule at the
 *   controller, so the requirement is visible in the code and survives any future
 *   change to the URL pattern.
 *
 * * The company is derived from the verified session token, NOT from the URL.
 *   There is deliberately no {@code {tenantId}} path variable: a company id in the
 *   address bar invites someone to change it. The frontend route
 *   /company/{id}/overview may show an id for readability, but the server ignores
 *   it entirely and answers only for the caller's own company.
 *
 * * Read-only. Nothing here changes data. The one write it triggers is an
 *   append-only audit entry recording who viewed the company's compliance figures
 *   and which modules were returned (GDPR Art. 5(2) accountability).
 *
 * ── WHAT IT DOES NOT RETURN ─────────────────────────────────────────────────────
 *
 * No personal data. Every module figure is a count, a total or a deadline; the
 * service and its readers document exactly what is excluded and why. See
 * {@link CompanyOverviewResponse}.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class CompanyOverviewController {

    private final CompanyOverviewService companyOverviewService;

    @GetMapping("/overview")
    public ResponseEntity<AppResponse<CompanyOverviewResponse>> getCompanyOverview(
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest request) {

        // jwt.getSubject() is the Cognito "sub" claim from the already-validated
        // token. It is the only identity input this endpoint accepts.
        CompanyOverviewResponse overview =
                companyOverviewService.build(jwt.getSubject(), request);

        return ResponseEntity.ok(AppResponse.success("Company overview loaded", overview));
    }
}
