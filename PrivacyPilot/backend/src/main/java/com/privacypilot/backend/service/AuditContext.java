package com.privacypilot.backend.service;

import com.privacypilot.backend.model.document.RegulaOneUser;
import com.privacypilot.backend.security.PrivacyPilotPermission;

/**
 * The "WHO and WHERE" part of an audit entry, gathered once per web request and
 * handed to {@link AuditService} for every action in that request.
 *
 * Keeping these together means a controller builds them ONE time (from the
 * logged-in user and the HTTP request) and then just says WHAT happened — it
 * never has to repeat the actor/ip details on every audit call.
 *
 * @param tenantId  the company the action belongs to — REQUIRED, so one tenant's
 *                  log can never mix with another's.
 * @param actorName the display name of the user doing the action (snapshot).
 * @param actorRole the single capacity the user acted under (snapshot) — the most
 *                  privileged PrivacyPilot code they hold, or their platform role
 *                  if they hold none. Never empty.
 * @param ipAddress the IP address the request came from (may be null if unknown).
 * @param userAgent the browser/user-agent string of the request (may be null).
 */
public record AuditContext(
        String tenantId,
        String actorName,
        String actorRole,
        String ipAddress,
        String userAgent) {

    /**
     * Builds the context from a logged-in PrivacyPilot user plus the request info.
     *
     * It works out the "acting as" role for you: it takes the most privileged
     * PrivacyPilot permission the user holds; if the user has no PrivacyPilot
     * permission at all (for example a platform super-admin), it falls back to
     * the given platform role so the audit line always shows a capacity.
     *
     * @param user         the logged-in user (their tenant and name are read from here)
     * @param platformRole the RegulaOne platform role, used only as the fallback
     * @param ipAddress    the request IP address (may be null)
     * @param userAgent    the request user-agent (may be null)
     */
    public static AuditContext forUser(RegulaOneUser user, String platformRole,
                                       String ipAddress, String userAgent) {
        String tenantId = (user.getTenant() != null) ? user.getTenant().getId() : null;
        PrivacyPilotPermission primary = user.primaryPrivacyPilotRole();
        String actorRole = (primary != null) ? primary.name() : platformRole;
        return new AuditContext(tenantId, user.getName(), actorRole, ipAddress, userAgent);
    }
}
