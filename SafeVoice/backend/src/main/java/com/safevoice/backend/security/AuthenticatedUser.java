package com.safevoice.backend.security;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * The authenticated staff caller, resolved by asking the RegulaOne backend (the single
 * source of truth for authentication) "who is this idToken?".
 *
 * Controllers receive this via a method parameter (see AuthenticatedUserArgumentResolver)
 * and MUST use {@link #tenantId()} for tenant scoping — the tenant is established
 * server-side from the verified session, never taken from a client-supplied header, which
 * is what enforces tenant isolation.
 *
 * The permission gate is {@link #requireAnyPermission}: call it at the top of a controller
 * method to allow only holders of the given SafeVoice permission(s), following least
 * privilege. (Reporters are anonymous and never have an AuthenticatedUser — their endpoints
 * live in the public controller.)
 *
 * @param userId       RegulaOne user id (used for audit attribution)
 * @param email        user email, for audit logging (may be null)
 * @param role         RegulaOne platform role name (e.g. ROLE_ADMIN)
 * @param tenantId     organisation the user belongs to — required, never null here
 * @param tenantName   organisation display name (may be null)
 * @param tenantStatus organisation status, e.g. ACTIVE / SUSPENDED (may be null)
 * @param permissions  cross-app permission codes from RegulaOne; only the SafeVoice ones
 *                     (see {@link SafeVoicePermission}) matter here. Never null.
 */
public record AuthenticatedUser(
        String userId,
        String email,
        String role,
        String tenantId,
        String tenantName,
        String tenantStatus,
        List<String> permissions) {

    // Null-guard / defensive copy so callers can always iterate permissions safely.
    public AuthenticatedUser {
        permissions = (permissions != null) ? List.copyOf(permissions) : List.of();
    }

    // Most-privileged first. Used to pick ONE role code to attribute a caller's action to
    // (audit "actor role" and the reporter-facing thread sender label), matching the frontend's
    // display priority so what the reporter sees stays the same.
    private static final SafeVoicePermission[] ROLE_PRIORITY = {
            SafeVoicePermission.SAFEVOICE_ADMIN,
            SafeVoicePermission.SAFEVOICE_COMPLIANCE_OFFICER,
            SafeVoicePermission.SAFEVOICE_AUDITOR,
            SafeVoicePermission.SAFEVOICE_INVESTIGATOR,
            SafeVoicePermission.SAFEVOICE_HR_MANAGER,
    };

    /**
     * The single SafeVoice role code to attribute this caller's actions to (for audit logging
     * and the thread sender label), derived from the verified session — never from a client
     * header. Picks the most privileged SafeVoice permission the caller holds; falls back to the
     * platform role when they hold none (e.g. a super admin acting cross-tenant).
     */
    public String primarySafeVoiceRole() {
        for (SafeVoicePermission p : ROLE_PRIORITY) {
            if (hasAnyPermission(p)) {
                return p.name();
            }
        }
        return role;
    }

    /** True if the caller holds at least one of the given SafeVoice permissions. */
    public boolean hasAnyPermission(SafeVoicePermission... allowed) {
        for (SafeVoicePermission p : allowed) {
            if (p != null && permissions.contains(p.name())) {
                return true;
            }
        }
        return false;
    }

    /**
     * The one and only permission gate. Allow the action ONLY if the caller holds at least
     * one of the permission codes passed in; otherwise throw 403 Forbidden.
     *
     * Pass exactly the permissions the action requires — nothing else is allowed. For an
     * admin-only action pass just {@code SAFEVOICE_ADMIN}; for an action several roles may
     * perform, list them all. Call it at the top of a controller method, e.g.:
     * {@code caller.requireAnyPermission(SafeVoicePermission.SAFEVOICE_ADMIN,
     *                                    SafeVoicePermission.SAFEVOICE_COMPLIANCE_OFFICER);}
     */
    public void requireAnyPermission(SafeVoicePermission... allowed) {
        if (hasAnyPermission(allowed)) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "You do not have permission to perform this action");
    }
}
