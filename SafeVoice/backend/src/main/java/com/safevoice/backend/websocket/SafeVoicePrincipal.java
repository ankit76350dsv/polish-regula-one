package com.safevoice.backend.websocket;

import java.security.Principal;
import java.util.List;

import lombok.RequiredArgsConstructor;

/**
 * Who is on the other end of a WebSocket connection.
 *
 * SafeVoice has TWO kinds of socket users, authenticated very differently:
 *   • STAFF     — a signed-in employee. Verified from the shared Cognito "idToken" cookie;
 *                 carries their organisation (tenantId) and SafeVoice permission codes.
 *   • REPORTER  — an anonymous whistleblower. Verified from their case access key; pinned
 *                 to exactly ONE case (caseId) and its tenant. No account, no permissions.
 *
 * The {@code name} is the unique id Spring uses to route "/user/..." messages to this
 * connection, so it must be stable and unique per connection-owner.
 *
 * This object is built once, at CONNECT time, from server-verified data only — never from
 * anything the client claims. Subscription checks then compare destinations against it.
 */
@RequiredArgsConstructor
public class SafeVoicePrincipal implements Principal {

    public enum Kind { STAFF, REPORTER }

    private final String name;
    private final Kind kind;
    private final String tenantId;
    private final String caseId;          // reporters only; null for staff
    private final List<String> permissions; // staff only; empty for reporters

    /** Build a staff principal from a verified token + the user's organisation. */
    public static SafeVoicePrincipal staff(String email, String tenantId, List<String> permissions) {
        return new SafeVoicePrincipal("staff:" + email, Kind.STAFF, tenantId, null, permissions);
    }

    /** Build a reporter principal pinned to one case (resolved from their access key). */
    public static SafeVoicePrincipal reporter(String caseId, String tenantId) {
        return new SafeVoicePrincipal("reporter:" + caseId, Kind.REPORTER, tenantId, caseId, List.of());
    }

    @Override
    public String getName() {
        return name;
    }

    public Kind getKind() {
        return kind;
    }

    public boolean isStaff() {
        return kind == Kind.STAFF;
    }

    public boolean isReporter() {
        return kind == Kind.REPORTER;
    }

    public String getTenantId() {
        return tenantId;
    }

    public String getCaseId() {
        return caseId;
    }

    public List<String> getPermissions() {
        return permissions;
    }
}
