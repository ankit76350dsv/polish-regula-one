package com.ksefflow.backend.security;

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
     * True if the caller holds the given KSeF permission code.
     * Use this in controllers/services to gate KSeF actions, e.g.
     * {@code if (!user.hasPermission(KsefPermission.KSEF_AUDITOR)) throw ...}.
     */
    public boolean hasPermission(KsefPermission permission) {
        return permission != null && permissions.contains(permission.name());
    }

    /**
     * A RegulaOne ROLE_ADMIN / ROLE_SUPER_ADMIN is always treated as a KSeF tenant
     * admin too, so existing admin-only endpoints keep working even before anyone
     * is explicitly granted KSEF_TENANT_ADMIN. Otherwise the explicit code is checked.
     */
    public boolean isKsefTenantAdmin() {
        boolean roleAdmin = role != null && (role.contains("ADMIN") || role.contains("SUPER"));
        return roleAdmin || hasPermission(KsefPermission.KSEF_TENANT_ADMIN);
    }
}
