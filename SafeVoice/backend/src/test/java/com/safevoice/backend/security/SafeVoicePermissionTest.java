package com.safevoice.backend.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Unit tests for the safe permission-code lookup. */
class SafeVoicePermissionTest {

    @Test
    void fromCode_returnsMatchingPermission() {
        assertThat(SafeVoicePermission.fromCode("SAFEVOICE_ADMIN"))
                .isEqualTo(SafeVoicePermission.SAFEVOICE_ADMIN);
        assertThat(SafeVoicePermission.fromCode("SAFEVOICE_AUDITOR"))
                .isEqualTo(SafeVoicePermission.SAFEVOICE_AUDITOR);
    }

    @Test
    void fromCode_returnsNullForUnknownOrNull() {
        assertThat(SafeVoicePermission.fromCode("KSEF_ADMIN")).isNull();
        assertThat(SafeVoicePermission.fromCode("")).isNull();
        assertThat(SafeVoicePermission.fromCode(null)).isNull();
    }
}
