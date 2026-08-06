package com.regulaone.backend.dashboard;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Unit tests for the platform dashboard's trend arithmetic.
 *
 * These run on every build (no database, no Spring context). What they guard is the
 * set of edge cases that used to be able to reach the screen as a crash or as a
 * nonsense string: dividing by a zero baseline, a null amount, and a change small
 * enough that calling it growth would be noise.
 *
 * The service is constructed with nulls on purpose — the two methods under test are
 * pure arithmetic and touch none of the collaborators, and building real ones would
 * only obscure that.
 */
class PlatformServiceTest {

    private final PlatformService service = new PlatformService(null, null, null, null);

    // ── Counts ──────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("a first-ever signup reads as New, not as a percentage of zero")
    void growthFromZeroBaseline() {
        // Dividing by a zero baseline is the classic crash here. "New" is the honest
        // answer: there is nothing to compare against.
        assertEquals("New", service.growthTrend(0, 5));
    }

    @Test
    @DisplayName("nothing before and nothing now is a dash, not 0%")
    void growthFromNothingToNothing() {
        // 0% would suggest a measurement was taken. There was no activity at all.
        assertEquals("—", service.growthTrend(0, 0));
    }

    @Test
    @DisplayName("growth and decline carry a sign")
    void growthUpAndDown() {
        assertEquals("+100%", service.growthTrend(5, 10));
        assertEquals("-50%", service.growthTrend(10, 5));
    }

    @Test
    @DisplayName("a change under one percent is steady, not noise dressed as growth")
    void growthWithinNoiseBand() {
        assertEquals("steady", service.growthTrend(1000, 1005));
    }

    @Test
    @DisplayName("a drop to zero is -100%, not a dash")
    void growthToZero() {
        // Losing every signup is a real, measurable change and must not be hidden.
        assertEquals("-100%", service.growthTrend(8, 0));
    }

    // ── Money ───────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("a first month of billings reads as New")
    void amountFromZeroBaseline() {
        assertEquals("New", service.amountTrend(BigDecimal.ZERO, new BigDecimal("2500.00")));
    }

    @Test
    @DisplayName("a missing baseline or a missing current amount never divides by zero")
    void amountWithNulls() {
        // Both nulls are reachable: a currency can have no earlier month on the chart,
        // and a quiet month can arrive as null rather than zero.
        assertEquals("—", service.amountTrend(null, null));
        assertEquals("New", service.amountTrend(null, new BigDecimal("10.00")));
        assertEquals("—", service.amountTrend(new BigDecimal("10.00"), null));
    }

    @Test
    @DisplayName("money growth is rounded to a whole percent and signed")
    void amountUpAndDown() {
        assertEquals("+50%", service.amountTrend(new BigDecimal("1000"), new BigDecimal("1500")));
        assertEquals("-25%", service.amountTrend(new BigDecimal("1000"), new BigDecimal("750")));
    }

    @Test
    @DisplayName("a change under two percent is steady")
    void amountWithinNoiseBand() {
        // Slightly wider band than the counts, because plan prices move in small
        // amounts far more often than customer numbers do.
        assertEquals("steady", service.amountTrend(new BigDecimal("1000"), new BigDecimal("1010")));
    }

    @Test
    @DisplayName("fractional prices do not lose precision on the way to a trend")
    void amountWithDecimals() {
        // BigDecimal is used for prices precisely so 199.99 → 399.98 is exactly +100%.
        assertEquals("+100%", service.amountTrend(new BigDecimal("199.99"), new BigDecimal("399.98")));
    }
}
