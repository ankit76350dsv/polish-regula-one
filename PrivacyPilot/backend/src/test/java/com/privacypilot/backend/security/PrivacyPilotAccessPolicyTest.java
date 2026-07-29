package com.privacypilot.backend.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Tests for the server-side "may this person use PrivacyPilot at all?" gate.
 *
 * These rules used to live only in the browser, so a disabled account or a lapsed plan
 * could still call the API directly. Each test below is one way that could happen, and
 * proves the server now says no.
 *
 * The test is deliberately PLAIN JUnit — no Spring context, no database, no network — so
 * it runs anywhere, including a sealed CI runner.
 */
class PrivacyPilotAccessPolicyTest {

    private static final String USER = "user-1";
    private static final String USER_ROLE = "ROLE_USER";
    private static final String SUPER_ADMIN = "ROLE_SUPER_ADMIN";
    private static final List<String> LICENSED = List.of("KSEFFLOW", "PRIVACYPILOT");
    private static final List<String> PP_ADMIN = List.of("KSEF_ADMIN", "PRIVACYPILOT_ADMIN");

    /** The happy path: everything in order, so nothing is thrown. */
    private static void allowFor(String role, Boolean enabled, String tenantStatus,
                                 Boolean planExpired, List<String> modules, List<String> perms) {
        PrivacyPilotAccessPolicy.requireAccess(USER, role, enabled, tenantStatus,
                planExpired, modules, perms);
    }

    /** Run the gate and return the 403 it threw, failing the test if it allowed the call. */
    private static ResponseStatusException refusalFor(String role, Boolean enabled, String tenantStatus,
                                                      Boolean planExpired, List<String> modules,
                                                      List<String> perms) {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> allowFor(role, enabled, tenantStatus, planExpired, modules, perms));
        // Every refusal must be a 403 — the frontend and any API client key on that status.
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        return ex;
    }

    @Test
    @DisplayName("allows a fully entitled user")
    void allowsEntitledUser() {
        assertDoesNotThrow(() ->
                allowFor(USER_ROLE, true, "ACTIVE", false, LICENSED, PP_ADMIN));
    }

    @Test
    @DisplayName("allows a user holding a lesser PrivacyPilot permission (e.g. auditor)")
    void allowsAnyPrivacyPilotPermission() {
        assertDoesNotThrow(() ->
                allowFor(USER_ROLE, true, "ACTIVE", false, LICENSED,
                        List.of("PRIVACYPILOT_AUDITOR")));
    }

    @Nested
    @DisplayName("account switched off")
    class AccountDisabled {

        @Test
        @DisplayName("refuses a disabled account — the bug this gate was added for")
        void refusesDisabledAccount() {
            refusalFor(USER_ROLE, false, "ACTIVE", false, LICENSED, PP_ADMIN);
        }

        @Test
        @DisplayName("fails CLOSED when the enabled flag is missing from /me")
        void refusesWhenEnabledFlagMissing() {
            refusalFor(USER_ROLE, null, "ACTIVE", false, LICENSED, PP_ADMIN);
        }

        @Test
        @DisplayName("refuses even a super admin whose account is disabled")
        void refusesDisabledSuperAdmin() {
            refusalFor(SUPER_ADMIN, false, "ACTIVE", false, LICENSED, PP_ADMIN);
        }
    }

    @Nested
    @DisplayName("organisation status")
    class OrganisationStatus {

        @Test
        @DisplayName("refuses a suspended organisation")
        void refusesSuspended() {
            refusalFor(USER_ROLE, true, "SUSPENDED", false, LICENSED, PP_ADMIN);
        }

        @Test
        @DisplayName("refuses an inactive organisation")
        void refusesInactive() {
            refusalFor(USER_ROLE, true, "INACTIVE", false, LICENSED, PP_ADMIN);
        }

        @Test
        @DisplayName("does not block when the status is absent (older organisation record)")
        void allowsUnknownStatus() {
            assertDoesNotThrow(() -> allowFor(USER_ROLE, true, null, false, LICENSED, PP_ADMIN));
            assertDoesNotThrow(() -> allowFor(USER_ROLE, true, "  ", false, LICENSED, PP_ADMIN));
        }
    }

    @Nested
    @DisplayName("subscription")
    class Subscription {

        @Test
        @DisplayName("refuses an expired plan")
        void refusesExpiredPlan() {
            refusalFor(USER_ROLE, true, "ACTIVE", true, LICENSED, PP_ADMIN);
        }

        @Test
        @DisplayName("treats a missing planExpired flag as not expired")
        void allowsWhenPlanFlagMissing() {
            assertDoesNotThrow(() ->
                    allowFor(USER_ROLE, true, "ACTIVE", null, LICENSED, PP_ADMIN));
        }
    }

    @Nested
    @DisplayName("module licence")
    class ModuleLicence {

        @Test
        @DisplayName("refuses when the organisation does not license PrivacyPilot")
        void refusesUnlicensedModule() {
            refusalFor(USER_ROLE, true, "ACTIVE", false, List.of("KSEFFLOW"), PP_ADMIN);
        }

        @Test
        @DisplayName("refuses when the module list is missing entirely")
        void refusesMissingModuleList() {
            refusalFor(USER_ROLE, true, "ACTIVE", false, null, PP_ADMIN);
        }
    }

    @Nested
    @DisplayName("module permission")
    class ModulePermission {

        @Test
        @DisplayName("refuses a user holding no PrivacyPilot permission")
        void refusesNoPrivacyPilotPermission() {
            refusalFor(USER_ROLE, true, "ACTIVE", false, LICENSED, List.of());
        }

        @Test
        @DisplayName("refuses a user holding only other apps' permissions")
        void refusesOtherAppPermissionsOnly() {
            refusalFor(USER_ROLE, true, "ACTIVE", false, LICENSED,
                    List.of("KSEF_ADMIN", "SAFEVOICE_REVIEWER"));
        }
    }

    @Nested
    @DisplayName("platform operator")
    class SuperAdmin {

        @Test
        @DisplayName("bypasses organisation, plan, module and permission checks")
        void superAdminBypassesCompanyChecks() {
            assertDoesNotThrow(() ->
                    allowFor(SUPER_ADMIN, true, "SUSPENDED", true, List.of(), List.of()));
        }
    }
}
