package com.ksefflow.backend.security;

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
 */
public record AuthenticatedUser(
        String userId,
        String email,
        String role,
        String tenantId,
        String tenantName,
        String tenantStatus) {
}
