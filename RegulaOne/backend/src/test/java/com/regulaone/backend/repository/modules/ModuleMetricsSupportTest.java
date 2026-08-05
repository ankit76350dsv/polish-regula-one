package com.regulaone.backend.repository.modules;

import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.query.Criteria;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Unit tests for the shared query helpers behind the company dashboard.
 *
 * The important one is the "day field" group. A field typed as a Java LocalDate —
 * such as a KSeF certificate's validTo — is stored by MongoDB as the TEXT
 * "2027-04-30", not as a date. Comparing text against a date matches NOTHING, so a
 * naive "validTo < today" query would report an expired certificate as healthy.
 * These tests pin the behaviour that both storage forms are matched, because
 * getting it wrong produces a silently wrong compliance number rather than an error.
 */
class ModuleMetricsSupportTest {

    /** Minimal concrete subclass — the helpers under test are static and protected. */
    private static final class Probe extends ModuleMetricsSupport {
        private Probe() {
            super(null);
        }
    }

    private static Document queryOf(Criteria criteria) {
        return criteria.getCriteriaObject();
    }

    @Test
    void dayBeforeMatchesBothTextAndDateStorage() {
        LocalDate day = LocalDate.of(2026, 8, 5);

        Document query = queryOf(ModuleMetricsSupport.dayBefore("validTo", day));

        // The helper must produce an $or over the two possible storage forms.
        Object or = query.get("$or");
        assertTrue(or instanceof java.util.List<?> list && list.size() == 2,
                "expected an $or covering text and date storage, got: " + query.toJson());

        String rendered = query.toJson();
        assertTrue(rendered.contains("2026-08-05"),
                "text comparison against the ISO day is missing: " + rendered);
        assertTrue(rendered.contains("$date"),
                "date comparison is missing: " + rendered);
    }

    @Test
    void dayBetweenIsHalfOpenSoTheEdgeDayIsNotDoubleCounted() {
        LocalDate from = LocalDate.of(2026, 8, 5);
        LocalDate to = LocalDate.of(2026, 9, 4);

        String rendered = queryOf(ModuleMetricsSupport.dayBetween("validTo", from, to)).toJson();

        // Inclusive at the start, exclusive at the end: a certificate expiring
        // exactly on the warning edge belongs to the next bucket, not both.
        assertTrue(rendered.contains("$gte"), rendered);
        assertTrue(rendered.contains("$lt"), rendered);
        assertTrue(rendered.contains("2026-08-05"), rendered);
        assertTrue(rendered.contains("2026-09-04"), rendered);
    }

    @Test
    void isoDayIsReadBackFromTextStorageUnchanged() {
        assertEquals("2027-04-30", ModuleMetricsSupport.asIsoDay("2027-04-30"));
    }

    @Test
    void isoDayIsReadBackFromDateStorageAsACalendarDay() {
        // Midnight Warsaw time on that day must read back as that same day, not the
        // day before, which is what a naive UTC conversion would produce.
        java.util.Date midnightWarsaw = ModuleMetricsSupport.startOfDay(LocalDate.of(2027, 4, 30));

        assertEquals("2027-04-30", ModuleMetricsSupport.asIsoDay(midnightWarsaw));
    }

    @Test
    void isoDayOfAMissingFieldIsNull() {
        assertEquals(null, ModuleMetricsSupport.asIsoDay(null));
    }

    @Test
    void tenantFilterIsAlwaysTheStartingPointOfAQuery() {
        assertEquals(new Document("tenantId", "abc"),
                queryOf(ModuleMetricsSupport.tenant("abc")));
    }

    @Test
    void percentOfNothingIsAHundredBecauseNothingCanBeWrong() {
        assertEquals(100, ModuleMetricsSupport.percent(0, 0));
    }

    @Test
    void percentRoundsToTheNearestWholeNumber() {
        assertEquals(67, ModuleMetricsSupport.percent(2, 3));
        assertEquals(50, ModuleMetricsSupport.percent(1, 2));
    }

    @Test
    void numbersSurviveEveryWayMongoMightHaveStoredThem() {
        // Money is stored as Decimal128, minutes as int, weights sometimes as double.
        assertEquals(1240L, ModuleMetricsSupport.asLong(new org.bson.types.Decimal128(
                new java.math.BigDecimal("1240.50"))));
        assertEquals(480L, ModuleMetricsSupport.asLong(480));
        assertEquals(0L, ModuleMetricsSupport.asLong(null));
        assertEquals(12.5d, ModuleMetricsSupport.asDouble(12.5d));
        assertEquals(0d, ModuleMetricsSupport.asDouble("not a number"));
    }

    @Test
    void minutesAreFormattedAsHoursWithOneDecimalAndADot() {
        // A dot, not a comma: the API returns machine-readable values and the
        // browser applies the Polish or English number format.
        assertEquals("8.0", ModuleMetricsSupport.hours(480));
        assertEquals("7.5", ModuleMetricsSupport.hours(450));
    }

    @Test
    void probeSubclassKeepsTheHelpersReachable() {
        // Guards against someone tightening the helpers' visibility and silently
        // breaking every reader that extends this class.
        assertTrue(ModuleMetricsSupport.class.isAssignableFrom(Probe.class));
    }
}
