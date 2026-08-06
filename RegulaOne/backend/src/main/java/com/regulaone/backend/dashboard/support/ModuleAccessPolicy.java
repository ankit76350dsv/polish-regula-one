package com.regulaone.backend.dashboard.support;

import com.regulaone.backend.models.Tenant;
import com.regulaone.backend.models.TenantModule;
import com.regulaone.backend.models.User;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * WHO MAY SEE WHICH MODULE on a dashboard — the one place that decision is made.
 *
 * WHY THIS CLASS EXISTS
 *   The company dashboard and the personal dashboard both have to answer the same
 *   question before they read anything: "may this person be shown this module?" Each
 *   used to answer it with its OWN private copy of these five methods. Two copies of an
 *   access rule is one copy too many: tighten the SafeVoice check in one file, forget
 *   the other, and one screen quietly shows what the other refuses. The rule now lives
 *   here once, and both dashboards ask it.
 *
 * ── THE GATES, APPLIED IN THIS ORDER SO THE ANSWER IS ALWAYS THE NARROWEST ──────
 *
 *   1. PLAN. A module the company does not pay for is NOT_IN_PLAN and is never queried.
 *   2. THE PERSON. A module this individual was not granted is MODULE_NOT_GRANTED and is
 *      never queried. Same rule the sidebar uses, so a dashboard can never show more
 *      than the menu allows (least privilege).
 *   3. SAFEVOICE ONLY — A FURTHER GATE. Whistleblower confidentiality is limited to
 *      authorised case handlers (dyrektywa (UE) 2019/1937 art. 16; ustawa o ochronie
 *      sygnalistów), so the SafeVoice card ALSO requires a SafeVoice staff permission.
 *      Being a company administrator is deliberately not enough on its own.
 *
 * The company id itself is NOT decided here: both callers take it from the signed-in
 * user's own record, which comes from the verified session token.
 *
 * All methods are static and hold no state, so this class is safe to use from the
 * dashboard worker threads.
 */
public final class ModuleAccessPolicy {

    /** Prefix of the SafeVoice staff permission codes (SAFEVOICE_ADMIN, …). */
    private static final String SAFEVOICE_PERMISSION_PREFIX = "SAFEVOICE_";

    private ModuleAccessPolicy() {
        // Rules only — never instantiated.
    }

    /** Module codes the company's active subscription includes. */
    public static Set<TenantModule> entitledModules(Tenant tenant) {
        Set<TenantModule> entitled = new LinkedHashSet<>();
        if (tenant != null
                && tenant.getCurrentPackage() != null
                && tenant.getCurrentPackage().getAppPackage() != null
                && tenant.getCurrentPackage().getAppPackage().getAppIds() != null) {
            entitled.addAll(tenant.getCurrentPackage().getAppPackage().getAppIds());
        }
        return entitled;
    }

    /** Module codes this particular person was granted. */
    public static Set<TenantModule> grantedModules(User caller) {
        Set<TenantModule> granted = new LinkedHashSet<>();
        if (caller != null && caller.getModuleIds() != null) {
            granted.addAll(caller.getModuleIds());
        }
        return granted;
    }

    /**
     * Does the caller hold any SafeVoice staff permission?
     *
     * Checked by PREFIX rather than against a fixed list, so a SafeVoice role added
     * later is picked up without a change here.
     */
    public static boolean hasSafeVoicePermission(User caller) {
        if (caller == null || caller.getPermissions() == null) return false;
        return caller.getPermissions().stream()
                .anyMatch(code -> code != null && code.startsWith(SAFEVOICE_PERMISSION_PREFIX));
    }

    /**
     * Why this module must not be read — or null when it may be.
     *
     * Returning a REASON CODE rather than just true/false lets the screen explain the
     * difference between "your company has not bought this" and "you personally were
     * not given access", which are very different conversations to have.
     */
    public static String blockedReason(TenantModule module,
                                      Set<TenantModule> entitled,
                                      Set<TenantModule> granted,
                                      boolean safeVoiceAuthorised) {
        if (entitled.isEmpty()) return "NO_ACTIVE_PLAN";
        if (!entitled.contains(module)) return "NOT_IN_PLAN";
        if (!granted.contains(module)) return "MODULE_NOT_GRANTED";
        if (module == TenantModule.SAFEVOICE && !safeVoiceAuthorised) {
            return "SAFEVOICE_PERMISSION_REQUIRED";
        }
        return null;
    }

    /** Maps a block reason to the card status the frontend switches on. */
    public static String statusFor(String reason) {
        return switch (reason) {
            case "NO_ACTIVE_PLAN", "NOT_IN_PLAN" -> "NOT_IN_PLAN";
            case "SAFEVOICE_PERMISSION_REQUIRED" -> "RESTRICTED";
            default -> "NO_ACCESS";
        };
    }
}
