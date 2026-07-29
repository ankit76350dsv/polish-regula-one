package com.ksefflow.backend.security;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * The authenticated caller, resolved by asking the RegulaOne backend (the single
 * source of truth for authentication) "who is this idToken?".
 *
 * Controllers receive this via a method parameter and MUST use {@link #tenantId()}
 * for tenant scoping. The tenant is established server-side from the verified
 * session — it is never taken from a client-supplied header — which enforces
 * tenant isolation.
 *
 * @param userId       RegulaOne user id (used for audit attribution)
 * @param email        user email, for audit logging (may be null)
 * @param role         RegulaOne role name (e.g. ROLE_ADMIN)
 * @param tenantId     organisation the user belongs to — required, never null here
 * @param tenantName   organisation display name (may be null)
 * @param tenantStatus organisation status, e.g. ACTIVE / SUSPENDED (may be null)
 * @param permissions  cross-app permission codes from RegulaOne; only the KSeF ones
 *                     (see {@link KsefPermission}) matter here. Never null.
 */
public record AuthenticatedUser(
        String userId,
        String email,
        String role,
        String tenantId,
        String tenantName,
        String tenantStatus,
        List<String> permissions) {

    // Defensive copy / null-guard so callers can always iterate permissions safely,
    // even if RegulaOne ever sends null or omits the field for an old user.
    public AuthenticatedUser {
        permissions = (permissions != null) ? List.copyOf(permissions) : List.of();
    }

    /**
     * The one and only permission gate. Allow the action ONLY if the caller holds at
     * least one of the permission codes passed in; otherwise throw 403 Forbidden.
     *
     * Pass exactly the permissions that the action requires — nothing else is allowed.
     * For an admin-only action, pass just {@code KSEF_ADMIN}. For an action that
     * several roles may perform, list them all (include {@code KSEF_ADMIN} when
     * the admin should also have access). Call it at the top of a controller method:
     * {@code caller.requireAnyPermission(KsefPermission.KSEF_ADMIN, KsefPermission.KSEF_CASE_MANAGER);}
     */
    public void requireAnyPermission(KsefPermission... allowed) {
        for (KsefPermission p : allowed) {
            if (p != null && permissions.contains(p.name())) {
                return; // caller holds a required permission → allowed
            }
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "You do not have permission to perform this action");
    }
}
