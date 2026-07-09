package com.safevoice.backend.model.embedded;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for EncryptedPayload.fromParts — the factory that builds a stored payload from the
 * three parts a browser sends, or returns null when the message carries no locked text.
 */
class EncryptedPayloadTest {

    @Test
    void fromParts_buildsPayloadWhenAllCorePartsPresent() {
        EncryptedPayload payload = EncryptedPayload.fromParts("CT", "IV", "WK", "AES-256-GCM");
        assertThat(payload).isNotNull();
        assertThat(payload.getCiphertext()).isEqualTo("CT");
        assertThat(payload.getIv()).isEqualTo("IV");
        assertThat(payload.getWrappedKey()).isEqualTo("WK");
        assertThat(payload.getAlgorithm()).isEqualTo("AES-256-GCM");
        assertThat(payload.getKmsKeyId()).isNull();
    }

    @Test
    void fromParts_defaultsAlgorithmWhenMissing() {
        assertThat(EncryptedPayload.fromParts("CT", "IV", "WK", null).getAlgorithm())
                .isEqualTo("AES-256-GCM");
        assertThat(EncryptedPayload.fromParts("CT", "IV", "WK", "  ").getAlgorithm())
                .isEqualTo("AES-256-GCM");
    }

    @Test
    void fromParts_returnsNullWhenAnyCorePartMissing() {
        assertThat(EncryptedPayload.fromParts(null, "IV", "WK", null)).isNull();
        assertThat(EncryptedPayload.fromParts("CT", null, "WK", null)).isNull();
        assertThat(EncryptedPayload.fromParts("CT", "IV", null, null)).isNull();
        assertThat(EncryptedPayload.fromParts("", "IV", "WK", null)).isNull();
        assertThat(EncryptedPayload.fromParts("CT", "  ", "WK", null)).isNull();
        assertThat(EncryptedPayload.fromParts("CT", "IV", "", null)).isNull();
    }
}
