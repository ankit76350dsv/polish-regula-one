package com.regulaone.backend.user;

import com.regulaone.backend.models.Role;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * A company administrator must never be able to create a PLATFORM OPERATOR.
 *
 * Both doors into a role — the invite and the role change — go through one whitelist, and
 * this pins that shut. It is worth a test of its own: the previous version accepted any
 * value the Role enum happened to contain, so an invite carrying "SUPER_ADMIN" created a
 * platform operator inside the caller's own company.
 */
class RoleEscalationTest {

    private final UserAdminService service = new UserAdminService(
            null, null, null, null, null);

    private Role invited(String role) {
        return (Role) ReflectionTestUtils.invokeMethod(service, "parseInvitedRole", role);
    }

    private Role assignable(String role) {
        return (Role) ReflectionTestUtils.invokeMethod(service, "parseAssignableRole", role);
    }

    // ── The two roles a company administrator may hand out ────────────────────

    @Test
    void acceptsTheTwoCompanyRolesHoweverTheyAreWritten() {
        for (String written : new String[] {"ROLE_ADMIN", "admin", "Admin", " ROLE_ADMIN "}) {
            assertEquals(Role.ROLE_ADMIN, assignable(written), written + " should mean administrator");
        }
        for (String written : new String[] {"ROLE_USER", "user", "USER"}) {
            assertEquals(Role.ROLE_USER, assignable(written), written + " should mean member");
        }
    }

    // ── The escalation this exists to stop ────────────────────────────────────

    @Test
    void refusesThePlatformOperatorRole() {
        for (String attempt : new String[] {"ROLE_SUPER_ADMIN", "SUPER_ADMIN", "super_admin"}) {
            assertThrows(IllegalArgumentException.class, () -> assignable(attempt),
                    attempt + " must be refused — it is the platform operator's role");
            assertThrows(IllegalArgumentException.class, () -> invited(attempt),
                    "an invite naming " + attempt + " must be refused");
        }
    }

    @Test
    void refusesUnknownRolesInsteadOfSilentlyDowngrading() {
        assertThrows(IllegalArgumentException.class, () -> assignable("ROLE_AUDITOR"));
        assertThrows(IllegalArgumentException.class, () -> invited("nonsense"));
    }

    // ── Nothing supplied is still the safe default ────────────────────────────

    @Test
    void invitingWithNoRoleGivesTheLeastPrivilegedOne() {
        assertEquals(Role.ROLE_USER, invited(null));
        assertEquals(Role.ROLE_USER, invited(""));
        assertEquals(Role.ROLE_USER, invited("   "));
    }
}
