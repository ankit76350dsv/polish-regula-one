package com.regulaone.backend.dashboard;

import com.regulaone.backend.common.AppResponse;
import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse;
import com.regulaone.backend.dashboard.dto.MyOverviewResponse;
import com.regulaone.backend.dashboard.dto.PlatformOverviewResponse;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The three RegulaOne overview screens. Each is ONE call that replaces six.
 *
 *   GET /api/admin/overview       — "is my COMPANY compliant?"      (company admin)
 *   GET /api/me/overview          — "am I in order?"                (any signed-in member)
 *   GET /api/superadmin/overview  — "how is the BUSINESS doing?"    (platform operator)
 *
 * WHY ALL THREE LIVE IN ONE CONTROLLER
 *   They are one feature seen by three audiences: assemble a read-only snapshot,
 *   record that it was read, return it. Each used to sit in its own one-method
 *   controller file, which spread a single idea across three places. The WORK still
 *   lives in three separate services, because the three answers obey different scoping
 *   rules — see {@link CompanyOverviewService}, {@link MyOverviewService} and
 *   {@link PlatformService}.
 *
 * ── THE RULES EVERY METHOD HERE FOLLOWS ─────────────────────────────────────────
 *
 * 1. THREE AUDIENCES, SO NO BLANKET RULE. This class deliberately carries no
 *    class-level {@code @PreAuthorize}, because the three endpoints need three
 *    different rules. EVERY method MUST therefore state its own. SecurityConfig's URL
 *    rules ({@code /api/admin/**} = ROLE_ADMIN, {@code /api/superadmin/**} =
 *    ROLE_SUPER_ADMIN, everything else authenticated) are a second line of defence —
 *    never the only one.
 *
 * 2. IDENTITY COMES FROM THE TOKEN, NEVER FROM THE URL. There is intentionally no
 *    {@code {tenantId}} or {@code {userId}} path variable anywhere in this class: an id
 *    in the address bar invites someone to change it. The frontend route
 *    /company/{id}/overview may show an id for readability; the server ignores it and
 *    answers only for the caller's own company, or for the caller themselves.
 *
 * 3. READ-ONLY. None of these change business data. The single write each one triggers
 *    is an append-only audit entry recording who looked and what they were shown
 *    (GDPR Art. 5(2) accountability).
 *
 * 4. NO PERSONAL DATA IN THE RESPONSES. Every figure is a count, a total or a
 *    deadline. Each response record and each module reader documents what it leaves
 *    out, and why.
 */
@RestController
@RequiredArgsConstructor
public class DashboardController {

    private final CompanyOverviewService companyOverviewService;
    private final MyOverviewService myOverviewService;
    private final PlatformService platformService;

    /**
     * The company-admin compliance dashboard: one snapshot of the company's position
     * across all six modules — KSeFFlow, WorkPulse, SafeWork, SafeVoice, WasteSync and
     * PrivacyPilot.
     *
     * The company is taken from the signed-in administrator's own record, so an admin
     * cannot ask for another company's numbers.
     */
    @GetMapping("/api/admin/overview")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<AppResponse<CompanyOverviewResponse>> getCompanyOverview(
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest request) {

        // jwt.getSubject() is the Cognito "sub" claim of the already-validated token.
        // It is the only identity input this endpoint accepts.
        return ResponseEntity.ok(AppResponse.success(
                "Company overview loaded",
                companyOverviewService.build(jwt.getSubject(), request)));
    }

    /**
     * The personal "My Workspace" dashboard: what the SIGNED-IN PERSON has to do,
     * across the same six modules.
     *
     * OPEN TO EVERY SIGNED-IN USER, and that is correct: the response contains only the
     * caller's OWN records. A company administrator is also an employee, with their own
     * medical certificate and their own shifts, so they may use it too.
     */
    @GetMapping("/api/me/overview")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AppResponse<MyOverviewResponse>> getMyOverview(
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest request) {

        return ResponseEntity.ok(AppResponse.success(
                "My workspace loaded",
                myOverviewService.build(jwt.getSubject(), request)));
    }

    /**
     * The platform operator's business overview across every customer company.
     *
     * WHY THIS READ IS AUDITED: RegulaOne is a processor of its customers' personal
     * data (GDPR Art. 28), and a processor must be able to show what its own staff
     * looked at. A customer asking "who at DSV looked at our account?" has to get the
     * answer from the trail, not from memory. The audit entry carries no tenantId,
     * because the read belongs to no single customer — and that is exactly what marks
     * it as a platform-wide access.
     *
     * The response holds COMMERCIAL facts only (plans, seats, billings) and never a
     * customer's compliance data — see {@link PlatformOverviewResponse}.
     */
    @GetMapping("/api/superadmin/overview")
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    public ResponseEntity<AppResponse<PlatformOverviewResponse>> getPlatformOverview(
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest request) {

        return ResponseEntity.ok(AppResponse.success(
                "Platform overview loaded",
                platformService.getPlatformOverview(jwt.getSubject(), request)));
    }
}
