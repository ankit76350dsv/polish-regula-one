package com.safevoice.backend.service.report.utils;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for the pure case helpers: access-key generation, SHA-256 hashing,
 * case-reference formatting, and incident-date parsing. No database, no mocks.
 */
class CaseReportUtilsTest {

    @Test
    void generateAccessKey_is64LowercaseHexChars() {
        String key = CaseReportUtils.generateAccessKey();
        assertThat(key).hasSize(64).matches("[0-9a-f]{64}");
    }

    @Test
    void generateAccessKey_isDifferentEachTime() {
        assertThat(CaseReportUtils.generateAccessKey())
                .isNotEqualTo(CaseReportUtils.generateAccessKey());
    }

    @Test
    void sha256Hex_matchesKnownVector() {
        // The SHA-256 of "abc" is a well-known constant — a good correctness anchor.
        assertThat(CaseReportUtils.sha256Hex("abc"))
                .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }

    @Test
    void sha256Hex_isStableForSameInput() {
        assertThat(CaseReportUtils.sha256Hex("hello"))
                .isEqualTo(CaseReportUtils.sha256Hex("hello"))
                .hasSize(64);
    }

    @Test
    void buildCaseReference_hasPrefixAndExpectedShape() {
        String ref = CaseReportUtils.buildCaseReference("SV", Instant.parse("2026-06-29T12:08:00Z"));
        // Shape is PREFIX/YEAR/MMDD/HHMM. We do not assert the exact hour (it is timezone-local).
        assertThat(ref).matches("SV/\\d{4}/\\d{4}/\\d{4}");
    }

    @Test
    void parseIncidentDate_parsesValidDateToStartOfDayUtc() {
        assertThat(CaseReportUtils.parseIncidentDate("2026-06-20"))
                .isEqualTo(Instant.parse("2026-06-20T00:00:00Z"));
    }

    @Test
    void parseIncidentDate_returnsNullForBlankOrInvalid() {
        assertThat(CaseReportUtils.parseIncidentDate(null)).isNull();
        assertThat(CaseReportUtils.parseIncidentDate("")).isNull();
        assertThat(CaseReportUtils.parseIncidentDate("not-a-date")).isNull();
    }
}
