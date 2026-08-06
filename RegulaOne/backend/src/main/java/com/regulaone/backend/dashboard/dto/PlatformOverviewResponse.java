package com.regulaone.backend.dashboard.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Everything the RegulaOne SuperAdmin "Platform Overview" screen shows, in ONE
 * response. Served by {@code GET /api/superadmin/overview} to ROLE_SUPER_ADMIN.
 *
 * SIMPLE EXPLANATION (what this is for):
 *   The platform operator (DSV Corporation) runs RegulaOne for many customer
 *   companies. This screen answers "how is the BUSINESS doing?" — how many
 *   customers, how many seats, what are they paying, which modules they bought, and
 *   which customers need a phone call this week.
 *
 * ── THE LINE THIS RESPONSE MUST NOT CROSS ───────────────────────────────────────
 *
 * Under GDPR, each customer company is the CONTROLLER of the personal data inside
 * its modules, and RegulaOne is only the PROCESSOR (Art. 4(7)–(8), Art. 28). A
 * processor may process that data only on the controller's instructions — running a
 * cross-customer statistics screen for its own commercial interest is not one of
 * those instructions.
 *
 * So this response carries COMMERCIAL AND OPERATIONAL FACTS ONLY:
 *
 *   ALLOWED — customer count, account status, seat counts, plan prices and dates,
 *             which modules a plan includes, plan expiry.
 *
 *   NEVER   — anything out of the six modules' own collections. No invoice contents,
 *             no employee names, no medical or BHP records, no whistleblower reports,
 *             no waste figures, no GDPR register entries, and no per-customer
 *             compliance verdict. Those belong to the customer, and their own
 *             administrator sees them on {@code /api/admin/overview}.
 *
 * The three dashboards therefore stack cleanly, each strictly narrower in what it may
 * read than the one above is in reach:
 *
 *   /api/superadmin/overview  →  "how is the business doing?"     commercial, all customers
 *   /api/admin/overview       →  "is my company compliant?"       one company's figures
 *   /api/me/overview          →  "am I in order?"                 one person's records
 *
 * ── EVERY NUMBER IS A REAL FACT ─────────────────────────────────────────────────
 *
 * There is no invented "score". In particular the old {@code complianceScore} field
 * is GONE — see the note on {@link Plans} for why it had to go.
 *
 * ── MONEY IS ALWAYS PAIRED WITH ITS CURRENCY ────────────────────────────────────
 *
 * Amounts are returned as a LIST, one entry per ISO-4217 currency, never as a single
 * total. Packages may be priced in PLN or EUR, and adding those together produces a
 * number that means nothing. See {@link Money}.
 */
public record PlatformOverviewResponse(

        // How many customer companies there are, and in what state.
        Tenants tenants,

        // How many people use the platform, against how many seats were sold.
        Seats seats,

        // What the active plans are worth per month, right now. One entry per
        // currency.
        List<Money> monthlyRecurring,

        // What was actually BILLED in each of the last 6 months, per currency.
        // A different quantity from monthlyRecurring — see {@link CurrencySeries}.
        List<CurrencySeries> billingsByMonth,

        // The state of the customers' subscriptions. Replaces the old
        // "compliance score" — see {@link Plans}.
        Plans plans,

        // Which modules the customers actually bought and switched on.
        List<ModuleAdoption> moduleAdoption,

        // The customers who need attention this week, worst first.
        List<WatchItem> watchlist,

        // When the server built this snapshot. Shown as "last updated" and used as
        // the provenance stamp on anything exported from the screen.
        Instant generatedAt) {

    /**
     * The customer base.
     *
     * {@code newTrend} compares how many companies SIGNED UP this month against last
     * month — it is the change in the signup RATE, not the change in the total. The
     * field is named after what it measures so the screen cannot put it next to the
     * total and imply the total grew by that much, which is what the old
     * {@code tenantTrend} did.
     *
     * Values: "+12%", "-8%", "steady", "New", "—".
     */
    public record Tenants(
            long total,
            long active,
            long suspended,
            long inactive,
            long newThisMonth,
            long newLastMonth,
            String newTrend) {
    }

    /**
     * Seats: people against paid capacity.
     *
     * {@code seatsContracted} is the sum of the seat limits on the active plans, and
     * {@code utilisationPct} is enabled users as a share of that. It is null when no
     * active plan declares a limit, because 0 would read as "no seats sold".
     *
     * Utilisation above 100% is possible and is deliberately NOT clamped: it means
     * customers are using more seats than they bought, which is the platform
     * operator's problem to act on rather than a display glitch to hide.
     */
    public record Seats(
            long usersEnabled,
            long usersDisabled,
            long newUsersThisMonth,
            long newUsersLastMonth,
            String newTrend,
            Long seatsContracted,
            Integer utilisationPct) {
    }

    /** An amount with the currency it is in. Never a bare number. */
    public record Money(String currency, BigDecimal amount) {
    }

    /**
     * One currency's billing history over the last 6 months.
     *
     * WHAT THIS SERIES IS: the value of the paid periods that STARTED in each month —
     * that is, what was billed. It is taken from the tenant's {@code packageHistory},
     * which PackageService maintains as a billing ledger with one entry per paid
     * period.
     *
     * WHAT IT IS NOT: it is not the recurring value of everything active during that
     * month. An annual plan sold in January appears in January at its full price and
     * contributes nothing to February.
     *
     * That is why it is named {@code billingsByMonth} and kept separate from
     * {@link #monthlyRecurring}. The two answer different questions and will not
     * match. The old field was called {@code revenueByMonth} and sat next to a card
     * labelled "Monthly Revenue" that was computed the other way, so the screen
     * showed two unequal numbers and implied they were the same thing.
     *
     * {@code trend} compares the last full month with the one before it, within this
     * currency only.
     */
    public record CurrencySeries(
            String currency,
            String trend,
            List<MonthPoint> points) {
    }

    /**
     * One point on a billing chart.
     *
     * {@code month} is "YYYY-MM" — a machine value, NOT "Jan". The browser turns it
     * into a month name in the reader's own language, which is why the same response
     * works for a Polish and an English operator. The old code formatted it with
     * {@code Locale.ENGLISH} on the server, which pinned the chart to English.
     */
    public record MonthPoint(String month, BigDecimal value) {
    }

    /**
     * The state of the customers' subscriptions.
     *
     * WHY THIS REPLACED THE "COMPLIANCE SCORE":
     *
     * The old response carried {@code complianceScore}, e.g. "99.8%", computed as
     * active tenants holding an unexpired plan divided by all tenants — and the screen
     * displayed it as "Compliance Score" with the note "Target: 100%".
     *
     * That number has nothing to do with compliance. It measures whether customers
     * have PAID. A platform operator reading "Compliance Score 99.8%" would
     * reasonably conclude that the customers' KSeF filings, GDPR registers and BHP
     * records are in order, when the figure cannot see any of those — and, per the
     * processor rule at the top of this file, must not.
     *
     * Inventing a compliance verdict is exactly what the project's AI rules forbid
     * ("never generate fake compliance logic"), and on a compliance product it is the
     * most dangerous kind of wrong number: it is reassuring, it looks precise, and it
     * would be quoted in a customer conversation.
     *
     * So the score is gone and these four honest counts took its place. They say what
     * the data actually supports: who is paid up, who lapsed, who is about to lapse,
     * and who never had a plan. Whether a CUSTOMER is compliant is answered on that
     * customer's own dashboard, by their own administrator.
     */
    public record Plans(
            long activeWithValidPlan,
            long expired,
            long expiringSoon,        // within the next 30 days
            long noPlan) {
    }

    /**
     * How far one module has been taken up.
     *
     * {@code tenantsPct} is the share of ACTIVE customers whose plan includes this
     * module — a stated, fixed denominator.
     *
     * The old {@code usagePct} divided each module's user count by the count of the
     * MOST POPULAR module, so the leading module always read 100% and no bar could
     * ever be compared with anything outside the chart. Two figures are returned here
     * instead, because "the plan includes it" and "people were actually given it" are
     * different facts and the gap between them is the interesting one.
     */
    public record ModuleAdoption(
            String module,
            long tenantsEntitled,
            int tenantsPct,
            long usersGranted) {
    }

    /**
     * One customer who needs attention, and why.
     *
     * This replaces a hardcoded "Recent Tenant Activity" table on the frontend that
     * listed invented companies and invented outcomes. It is deliberately a WATCHLIST
     * rather than an activity feed: RegulaOne's own audit trail currently records only
     * dashboard views, so an honest activity feed would say almost nothing — and
     * showing which customer administrators are logged in is closer to watching the
     * customer than to running the platform.
     *
     * Every item here is commercial: a plan date, an account status or a seat count.
     *
     * reason — PLAN_EXPIRED | PLAN_EXPIRING | TENANT_SUSPENDED | NO_PLAN | SEATS_EXCEEDED
     * tone   — RISK | WARN | NEUTRAL, so the browser colours it without re-deciding
     * daysRemaining — whole days until the plan lapses; negative once it has, null
     *                 when the item is not about a date
     */
    public record WatchItem(
            String tenantId,
            String tenantName,
            String reason,
            String tone,
            Integer daysRemaining,
            String detail) {
    }
}
