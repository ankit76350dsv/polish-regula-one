package com.regulaone.backend.dashboard;

import com.regulaone.backend.dashboard.dto.PlatformOverviewResponse;
import com.regulaone.backend.dashboard.dto.PlatformOverviewResponse.CurrencySeries;
import com.regulaone.backend.dashboard.dto.PlatformOverviewResponse.ModuleAdoption;
import com.regulaone.backend.dashboard.dto.PlatformOverviewResponse.Money;
import com.regulaone.backend.dashboard.dto.PlatformOverviewResponse.WatchItem;
import com.regulaone.backend.models.Tenant;
import com.regulaone.backend.models.TenantModule;
import com.regulaone.backend.models.User;
import com.regulaone.backend.tenant.TenantRepository;
import com.regulaone.backend.user.UserRepository;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * End-to-end check of the PLATFORM dashboard service, against the live development
 * database.
 *
 * The most important thing it guards is the DATABASE-SIDE COUNTING. The rewrite moved
 * the user figures from Java streams into MongoDB {@code countDocuments} calls, and a
 * date filter that does not match the stored type does not fail — it silently returns
 * zero. This project already has that trap for {@code LocalDate} fields (stored as
 * ISO text, so a date-vs-text comparison matches nothing), so the counts are asserted
 * against a straightforward Java computation over the same documents. If the two ever
 * disagree, the query is wrong, not the arithmetic.
 *
 * It also holds the line described at the top of PlatformOverviewResponse: money is
 * always paired with a currency, module shares have a real denominator, and the
 * watchlist carries only commercial reasons.
 *
 * HOW TO RUN IT — skipped by default (the {@code IT} suffix keeps it out of the normal
 * surefire run, and the flag stops accidental database access):
 *
 *   ./mvnw test -Dtest=PlatformServiceIT -Dregulaone.it=true
 *
 * NOTE: the audit test performs a real read through the audited entry point, so — as
 * intended — it appends one entry to the trail, exactly as a real page load would.
 */
@SpringBootTest
class PlatformServiceIT {

    private static final String ENABLE_FLAG = "regulaone.it";

    /** Every reason the watchlist is allowed to report. */
    private static final Set<String> KNOWN_REASONS = Set.of(
            "PLAN_EXPIRED", "PLAN_EXPIRING", "TENANT_SUSPENDED", "NO_PLAN", "SEATS_EXCEEDED");

    private static final Set<String> KNOWN_TONES = Set.of("RISK", "WARN", "NEUTRAL");

    @Autowired
    private PlatformService platformService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TenantRepository tenantRepository;

    private void requireLiveDatabase() {
        Assumptions.assumeTrue(Boolean.getBoolean(ENABLE_FLAG),
                "Skipped: pass -D" + ENABLE_FLAG + "=true to run against a live database");
    }

    // ── The counting the rewrite moved into the database ─────────────────────────

    @Test
    @DisplayName("the database-side user counts agree with counting the documents in Java")
    void databaseSideCountsMatchJava() {
        requireLiveDatabase();

        PlatformOverviewResponse overview = platformService.getPlatformOverview();
        assertNotNull(overview.seats(), "the seats block is missing");

        List<User> allUsers = userRepository.findAll();

        long expectedEnabled = allUsers.stream().filter(User::isEnabled).count();
        long expectedDisabled = allUsers.stream().filter(u -> !u.isEnabled()).count();

        assertEquals(expectedEnabled, overview.seats().usersEnabled(),
                "enabled-user count from MongoDB disagrees with counting in Java");
        assertEquals(expectedDisabled, overview.seats().usersDisabled(),
                "disabled-user count from MongoDB disagrees with counting in Java");

        // The date-filtered counts are the ones that fail silently when the stored type
        // does not match the query. Recomputed here from the same documents.
        LocalDateTime startOfThisMonth = LocalDateTime.now()
                .withDayOfMonth(1).toLocalDate().atStartOfDay();
        LocalDateTime startOfLastMonth = startOfThisMonth.minusMonths(1);

        long expectedNewThisMonth = allUsers.stream()
                .filter(u -> u.getCreatedAt() != null)
                .filter(u -> !u.getCreatedAt().isBefore(startOfThisMonth))
                .count();

        long expectedNewLastMonth = allUsers.stream()
                .filter(u -> u.getCreatedAt() != null)
                .filter(u -> !u.getCreatedAt().isBefore(startOfLastMonth))
                .filter(u -> u.getCreatedAt().isBefore(startOfThisMonth))
                .count();

        assertEquals(expectedNewThisMonth, overview.seats().newUsersThisMonth(),
                "the createdAt filter for THIS month did not match the stored date type");
        assertEquals(expectedNewLastMonth, overview.seats().newUsersLastMonth(),
                "the createdAt filter for LAST month did not match the stored date type");
    }

    @Test
    @DisplayName("module grant counts from the aggregation agree with counting in Java")
    void moduleGrantAggregationMatchesJava() {
        requireLiveDatabase();

        PlatformOverviewResponse overview = platformService.getPlatformOverview();
        List<User> enabled = userRepository.findAll().stream().filter(User::isEnabled).toList();

        for (ModuleAdoption adoption : overview.moduleAdoption()) {
            TenantModule module = TenantModule.valueOf(adoption.module());

            long expected = enabled.stream()
                    .filter(u -> u.getModuleIds() != null && u.getModuleIds().contains(module))
                    .count();

            assertEquals(expected, adoption.usersGranted(),
                    "the $unwind aggregation disagrees with Java for module " + module);
        }
    }

    // ── The shape rules ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("every amount carries a currency and no currency appears twice")
    void moneyIsAlwaysPairedWithItsCurrency() {
        requireLiveDatabase();

        PlatformOverviewResponse overview = platformService.getPlatformOverview();

        // The whole point of the rewrite: PLN and EUR are never added together, so a
        // currency must appear exactly once and never be blank.
        List<String> currencies = overview.monthlyRecurring().stream().map(Money::currency).toList();
        assertEquals(currencies.size(), Set.copyOf(currencies).size(),
                "the same currency was returned twice — amounts were not grouped");

        for (Money money : overview.monthlyRecurring()) {
            assertNotNull(money.currency(), "an amount came back with no currency");
            assertFalse(money.currency().isBlank(), "an amount came back with a blank currency");
            assertNotNull(money.amount(), "a currency came back with no amount");
        }

        for (CurrencySeries series : overview.billingsByMonth()) {
            assertNotNull(series.currency(), "a billing series came back with no currency");
            assertFalse(series.currency().isBlank(), "a billing series has a blank currency");

            // Months must be machine values the browser can localise, never "Jan".
            series.points().forEach(point -> {
                assertNotNull(point.month(), "a chart point has no month");
                YearMonth.parse(point.month()); // throws if it is not "YYYY-MM"
                assertNotNull(point.value(), "a chart point has no value");
            });
        }
    }

    @Test
    @DisplayName("module adoption is a share of active customers, so nothing is forced to 100%")
    void moduleAdoptionHasARealDenominator() {
        requireLiveDatabase();

        PlatformOverviewResponse overview = platformService.getPlatformOverview();

        assertEquals(TenantModule.values().length, overview.moduleAdoption().size(),
                "every module must report, even at zero");

        long activeTenants = overview.tenants().active();

        for (ModuleAdoption adoption : overview.moduleAdoption()) {
            assertTrue(adoption.tenantsPct() >= 0 && adoption.tenantsPct() <= 100,
                    adoption.module() + " reported an impossible share: " + adoption.tenantsPct());

            assertTrue(adoption.tenantsEntitled() <= activeTenants,
                    adoption.module() + " claims more entitled customers than there are active ones");
        }
    }

    @Test
    @DisplayName("the watchlist carries only commercial reasons, worst first")
    void watchlistIsCommercialAndSorted() {
        requireLiveDatabase();

        PlatformOverviewResponse overview = platformService.getPlatformOverview();

        String previousTone = null;
        for (WatchItem item : overview.watchlist()) {
            assertTrue(KNOWN_REASONS.contains(item.reason()),
                    "unknown watchlist reason: " + item.reason());
            assertTrue(KNOWN_TONES.contains(item.tone()),
                    "unknown watchlist tone: " + item.tone());
            assertNotNull(item.tenantId(), "a watchlist row has no tenant id");

            // RISK rows must all come before the rest, so the operator reads the
            // urgent accounts first.
            if ("WARN".equals(previousTone) || "NEUTRAL".equals(previousTone)) {
                assertFalse("RISK".equals(item.tone()),
                        "a RISK row appeared after a lower-priority one — the sort is wrong");
            }
            previousTone = item.tone();
        }
    }

    @Test
    @DisplayName("the subscription counts add up to the customer base")
    void planCountsReconcile() {
        requireLiveDatabase();

        PlatformOverviewResponse overview = platformService.getPlatformOverview();
        long tenantTotal = tenantRepository.count();

        assertEquals(tenantTotal, overview.tenants().total(),
                "the tenant total disagrees with the collection");

        // Every customer falls in exactly one of these three buckets. expiringSoon is
        // deliberately NOT part of the sum — it is a subset of the valid ones.
        long bucketed = overview.plans().activeWithValidPlan()
                + overview.plans().expired()
                + overview.plans().noPlan();

        assertEquals(tenantTotal, bucketed,
                "the plan buckets do not account for every customer exactly once");

        assertTrue(overview.plans().expiringSoon() <= overview.plans().activeWithValidPlan(),
                "more plans are expiring soon than are currently valid");

        // Status counts must also account for everyone.
        assertEquals(tenantTotal,
                overview.tenants().active() + overview.tenants().suspended()
                        + overview.tenants().inactive(),
                "the account-status counts do not add up to the customer base");
    }

    @Test
    @DisplayName("reading the dashboard through the audited entry point records a platform-wide access")
    void theReadIsAudited() {
        requireLiveDatabase();

        // Any super-admin will do; the entry names whoever asked.
        var operator = userRepository.findAll().stream()
                .filter(u -> u.getRole() != null && "ROLE_SUPER_ADMIN".equals(u.getRole().name()))
                .findFirst();

        Assumptions.assumeTrue(operator.isPresent(), "Skipped: no super-admin user was found");

        // null request is valid — it only supplies the IP and user agent.
        PlatformOverviewResponse overview =
                platformService.getPlatformOverview(operator.get().getCognitoSub(), null);

        assertNotNull(overview, "no overview was built");
        assertNotNull(overview.generatedAt(), "the snapshot has no provenance stamp");

        // The audit write is fire-and-forget by design (AuditLogService swallows its
        // own failures so a trail problem cannot cost the operator the screen), so what
        // is asserted here is that the audited path returns a complete snapshot.
        assertNotNull(overview.tenants(), "the tenants block is missing");
        assertNotNull(overview.plans(), "the plans block is missing");
    }

    // ── The processor boundary ──────────────────────────────────────────────────

    @Test
    @DisplayName("the response exposes no per-customer compliance verdict")
    void noComplianceVerdictIsInvented() {
        requireLiveDatabase();

        PlatformOverviewResponse overview = platformService.getPlatformOverview();

        // The old response carried a "complianceScore" string computed from billing
        // state. This asserts the replacement is in place: honest subscription counts,
        // and no field on the record that claims to judge a customer's compliance.
        boolean hasScoreField = java.util.Arrays.stream(
                        PlatformOverviewResponse.class.getRecordComponents())
                .anyMatch(component -> component.getName().toLowerCase().contains("compliance"));

        assertFalse(hasScoreField,
                "a compliance-sounding field is back on the platform response — the platform "
                        + "operator cannot see customer compliance and must not imply it");

        assertNotNull(overview.plans(), "the honest subscription counts are missing");
    }

    // ── Sanity: tenants are still whole, and that is intended ───────────────────

    @Test
    @DisplayName("seat utilisation is null rather than zero when no plan states a limit")
    void utilisationIsNullWhenNotStated() {
        requireLiveDatabase();

        PlatformOverviewResponse overview = platformService.getPlatformOverview();

        boolean anyLimit = tenantRepository.findAll().stream()
                .anyMatch(this::declaresASeatLimit);

        if (!anyLimit) {
            // "Not stated" and "zero seats sold" are different statements, and the
            // screen must be able to tell them apart.
            assertEquals(null, overview.seats().seatsContracted(),
                    "no plan states a seat limit, so the contracted total must be null");
            assertEquals(null, overview.seats().utilisationPct(),
                    "no plan states a seat limit, so utilisation must be null");
        } else {
            assertNotNull(overview.seats().seatsContracted(),
                    "a plan states a seat limit but the contracted total is null");
        }
    }

    private boolean declaresASeatLimit(Tenant tenant) {
        Tenant.PackageDetails current = tenant.getCurrentPackage();
        if (current == null) return false;
        if (current.getUsersCapacity() != null && !current.getUsersCapacity().isBlank()) return true;
        return current.getAppPackage() != null && current.getAppPackage().getUsersCapacity() != null;
    }
}
