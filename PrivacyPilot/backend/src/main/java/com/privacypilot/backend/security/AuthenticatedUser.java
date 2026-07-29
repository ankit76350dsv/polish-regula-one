package com.privacypilot.backend.security;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * The authenticated caller, resolved by asking the RegulaOne backend "who is this
 * idToken?" (see {@link RegulaOneAuthClient}). RegulaOne is the single source of
 * truth for authentication and tenant membership.
 *
 * Controllers receive this by simply declaring an {@code AuthenticatedUser} parameter
 * (see AuthenticatedUserArgumentResolver) and MUST use {@link #tenantId()} for tenant
 * scoping — the tenant is established server-side from the verified session, never
 * from a client-supplied header, which is what enforces tenant isolation.
 *
 * The permission gate is {@link #requireAnyPermission}: call it at the top of a
 * controller method to allow only holders of the given PrivacyPilot permission(s),
 * following least privilege.
 *
 * IMPORTANT — two different things:
 *   • {@link #role()}        → the PLATFORM role, a single string
 *                              (ROLE_ADMIN | ROLE_USER | ROLE_SUPER_ADMIN).
 *   • {@link #permissions()} → the ARRAY of module permission codes the user holds
 *                              across all apps; only the PRIVACYPILOT_* ones matter here.
 */
public record AuthenticatedUser(
        String userId,
        String name,
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

    // Most-privileged first — used to pick ONE code to attribute a caller's action to.
    private static final PrivacyPilotPermission[] ROLE_PRIORITY = {
            PrivacyPilotPermission.PRIVACYPILOT_ADMIN,
            PrivacyPilotPermission.PRIVACYPILOT_COMPLIANCE_OFFICER,
            PrivacyPilotPermission.PRIVACYPILOT_DPO,
            PrivacyPilotPermission.PRIVACYPILOT_AUDITOR,
            PrivacyPilotPermission.PRIVACYPILOT_EMPLOYEE,
    };

    // The platform operator sees everything and bypasses the module permission checks.
    public boolean isSuperAdmin() {
        return "ROLE_SUPER_ADMIN".equals(role);
    }

    /** True if the caller holds at least one of the given PrivacyPilot permissions. */
    public boolean hasAnyPermission(PrivacyPilotPermission... allowed) {
        if (isSuperAdmin()) {
            return true;
        }
        for (PrivacyPilotPermission p : allowed) {
            if (p != null && permissions.contains(p.name())) {
                return true;
            }
        }
        return false;
    }

    /**
     * The one and only permission gate. Allow the action ONLY if the caller holds at
     * least one of the permission codes passed in; otherwise throw 403 Forbidden.
     * Call it at the top of a controller method, e.g.:
     * {@code caller.requireAnyPermission(PrivacyPilotPermission.PRIVACYPILOT_ADMIN,
     *                                    PrivacyPilotPermission.PRIVACYPILOT_COMPLIANCE_OFFICER);}
     */
    public void requireAnyPermission(PrivacyPilotPermission... allowed) {
        if (hasAnyPermission(allowed)) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "You do not have permission to perform this action");
    }

    /**
     * The single code to attribute this caller's actions to in the audit trail: the
     * most privileged PrivacyPilot code they hold, falling back to the platform role
     * when they hold none (e.g. a super admin acting cross-tenant). Never empty.
     */
    public String primaryPrivacyPilotRole() {
        for (PrivacyPilotPermission p : ROLE_PRIORITY) {
            if (permissions.contains(p.name())) {
                return p.name();
            }
        }
        return role;
    }
}
