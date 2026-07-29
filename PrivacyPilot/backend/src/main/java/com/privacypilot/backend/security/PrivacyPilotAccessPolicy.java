package com.privacypilot.backend.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * The ONE place that decides "is this signed-in person allowed to use PrivacyPilot at
 * all?" — checked on the server, on every request, before any controller runs.
 *
 * WHY THIS EXISTS (the bug it fixes):
 * The browser used to be the only thing checking these rules (see the frontend's
 * lib/sso.js → evaluatePrivacyPilotAccess). So the SCREENS were locked, but the API was
 * not: someone whose account had been switched off, whose company's plan had run out, or
 * whose company never bought the PrivacyPilot module could still call the API directly
 * with their existing login cookie and read or change the whole register until that
 * cookie expired. A rule that only the browser enforces is not a rule — the project
 * rules say "never trust frontend validation" — so the same checks now run here.
 *
 * WHAT IT CHECKS (same order, same meaning as the browser, so the two never disagree):
 *   1. Is the ACCOUNT switched on?            (no  → 403)
 *   2. Is the caller the platform operator?   (yes → allowed, skip the rest)
 *   3. Is the COMPANY still active?           (suspended/closed → 403)
 *   4. Has the company's PLAN expired?        (yes → 403)
 *   5. Did the company BUY PrivacyPilot?      (no  → 403)
 *   6. Does the person hold a PrivacyPilot PERMISSION? (none → 403)
 *
 * All the values come from RegulaOne's /api/auth/me answer — the platform is the single
 * source of truth for accounts, plans and module licences. Nothing here is read from the
 * request, so a caller cannot talk their way past it.
 *
 * FAIL CLOSED: if the "account switched on" flag is missing from the answer we treat the
 * account as switched OFF, exactly like the browser does (`raw.enabled === true`). It is
 * always safer to deny an unclear answer than to allow it.
 *
 * NOTE on step 6: every controller ALSO calls {@code caller.requireAnyPermission(...)}
 * for the specific action. Step 6 is deliberately kept as well — it is the coarse "may
 * you be in this app" gate, and it means a future endpoint that forgets its own check is
 * still not open to people with no PrivacyPilot permission at all.
 */
@Slf4j
public final class PrivacyPilotAccessPolicy {

    /**
     * The module key as RegulaOne spells it in /me.moduleIds (its TenantModule enum) and
     * as the frontend spells it in lib/sso.js. All three MUST stay identical.
     */
    public static final String PRIVACYPILOT_MODULE = "PRIVACYPILOT";

    /** The platform-operator role; it sees everything and skips the company-level checks. */
    private static final String SUPER_ADMIN_ROLE = "ROLE_SUPER_ADMIN";

    /** The only company status that may use the app. Anything else explicit is refused. */
    private static final String TENANT_ACTIVE = "ACTIVE";

    private PrivacyPilotAccessPolicy() {
        // Rules holder — never constructed.
    }

    /**
     * Allow the caller into PrivacyPilot, or throw 403 with the reason.
     *
     * @param userId      the caller's id — logged on a refusal so a denied attempt can be
     *                    investigated later. Only the id is logged, never name or e-mail.
     * @param role        the platform role (ROLE_ADMIN | ROLE_USER | ROLE_SUPER_ADMIN)
     * @param enabled     is the account switched on? null/missing is treated as OFF
     * @param tenantStatus the company's status (ACTIVE | INACTIVE | SUSPENDED). When it is
     *                    absent we do NOT block — an older company record may simply not
     *                    carry the field yet, and refusing on "unknown" here would lock
     *                    out companies that are in fact fine.
     * @param planExpired has the company's subscription run out? null/missing means "no"
     * @param moduleIds   the modules the company/user may open, e.g. ["PRIVACYPILOT"]
     * @param permissions every module permission code the user holds, across all apps
     * @throws ResponseStatusException 403 with a readable reason when access is refused
     */
    public static void requireAccess(String userId, String role, Boolean enabled,
                                     String tenantStatus, Boolean planExpired,
                                     List<String> moduleIds, List<String> permissions) {

        // 1. The account itself must be switched on. Missing flag = treated as switched off.
        if (!Boolean.TRUE.equals(enabled)) {
            throw refuse(userId, "account_disabled", "Your account has been disabled");
        }

        // 2. The platform operator supports every company, so the company-level checks
        //    (status, plan, module licence, permission) do not apply to them.
        if (SUPER_ADMIN_ROLE.equals(role)) {
            return;
        }

        // 3. A company that is suspended or closed must not be able to read or change
        //    compliance records. We only refuse a status we were actually told about.
        if (tenantStatus != null && !tenantStatus.isBlank()
                && !TENANT_ACTIVE.equalsIgnoreCase(tenantStatus)) {
            throw refuse(userId, "tenant_" + tenantStatus.toLowerCase(),
                    "Your organisation's access is currently " + tenantStatus.toLowerCase());
        }

        // 4. An expired subscription means the company may not use the app any more.
        if (Boolean.TRUE.equals(planExpired)) {
            throw refuse(userId, "plan_expired",
                    "Your organisation's subscription has expired");
        }

        // 5. The company must actually license this module.
        if (moduleIds == null || !moduleIds.contains(PRIVACYPILOT_MODULE)) {
            throw refuse(userId, "module_not_licensed",
                    "PrivacyPilot is not enabled for your account");
        }

        // 6. And the person must hold at least one PrivacyPilot permission.
        if (PrivacyPilotPermission.primaryOf(permissions) == null) {
            throw refuse(userId, "no_permission",
                    "You do not have a PrivacyPilot permission");
        }
    }

    // Build the 403 and leave a security log line. The reason CODE is for us (log/alerting);
    // the MESSAGE is what the caller sees. Neither contains personal data beyond the user id.
    private static ResponseStatusException refuse(String userId, String reasonCode, String message) {
        log.warn("[PrivacyPilotAccessPolicy] access refused userId={} reason={}", userId, reasonCode);
        return new ResponseStatusException(HttpStatus.FORBIDDEN, message);
    }
}
