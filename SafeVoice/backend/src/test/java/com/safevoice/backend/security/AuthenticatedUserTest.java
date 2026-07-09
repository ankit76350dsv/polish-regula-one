package com.safevoice.backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Unit tests for the permission gate and role-priority logic on the authenticated caller.
 * These guard AUTHORIZATION — the checks that decide who may do what.
 */
class AuthenticatedUserTest {

    private AuthenticatedUser userWith(String... permissions) {
        return new AuthenticatedUser("u1", "u1@acme.test", "ROLE_USER",
                "acme", "Acme", "ACTIVE", List.of(permissions));
    }

    @Test
    void requireAnyPermission_passesWhenCallerHoldsOne() {
        AuthenticatedUser user = userWith("SAFEVOICE_COMPLIANCE_OFFICER");
        assertThatCode(() -> user.requireAnyPermission(
                SafeVoicePermission.SAFEVOICE_ADMIN,
                SafeVoicePermission.SAFEVOICE_COMPLIANCE_OFFICER))
                .doesNotThrowAnyException();
    }

    @Test
    void requireAnyPermission_throws403WhenCallerHoldsNone() {
        AuthenticatedUser user = userWith("SAFEVOICE_AUDITOR");
        assertThatThrownBy(() -> user.requireAnyPermission(SafeVoicePermission.SAFEVOICE_ADMIN))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    void hasAnyPermission_reflectsHeldPermissions() {
        AuthenticatedUser user = userWith("SAFEVOICE_INVESTIGATOR");
        assertThat(user.hasAnyPermission(SafeVoicePermission.SAFEVOICE_INVESTIGATOR)).isTrue();
        assertThat(user.hasAnyPermission(SafeVoicePermission.SAFEVOICE_ADMIN)).isFalse();
    }

    @Test
    void primarySafeVoiceRole_picksMostPrivileged() {
        // Holds both — the higher-priority COMPLIANCE_OFFICER must win over INVESTIGATOR.
        AuthenticatedUser user = userWith("SAFEVOICE_INVESTIGATOR", "SAFEVOICE_COMPLIANCE_OFFICER");
        assertThat(user.primarySafeVoiceRole()).isEqualTo("SAFEVOICE_COMPLIANCE_OFFICER");
    }

    @Test
    void primarySafeVoiceRole_fallsBackToPlatformRoleWhenNoSafeVoicePermission() {
        AuthenticatedUser user = userWith(); // no SafeVoice permissions
        assertThat(user.primarySafeVoiceRole()).isEqualTo("ROLE_USER");
    }

    @Test
    void nullPermissions_becomeEmptyAndDenyAccess() {
        AuthenticatedUser user = new AuthenticatedUser("u", null, "ROLE_USER",
                "acme", null, null, null);
        assertThat(user.permissions()).isEmpty();
        assertThatThrownBy(() -> user.requireAnyPermission(SafeVoicePermission.SAFEVOICE_ADMIN))
                .isInstanceOf(ResponseStatusException.class);
    }
}
