package com.regulaone.backend.services;

import com.regulaone.backend.dto.Platform.PlatformOverviewResponse;
import com.regulaone.backend.dto.Platform.PlatformOverviewResponse.CurrencySeries;
import com.regulaone.backend.dto.Platform.PlatformOverviewResponse.ModuleAdoption;
import com.regulaone.backend.dto.Platform.PlatformOverviewResponse.MonthPoint;
import com.regulaone.backend.dto.Platform.PlatformOverviewResponse.Money;
import com.regulaone.backend.dto.Platform.PlatformOverviewResponse.Plans;
import com.regulaone.backend.dto.Platform.PlatformOverviewResponse.Seats;
import com.regulaone.backend.dto.Platform.PlatformOverviewResponse.WatchItem;
import com.regulaone.backend.models.AppPackage;
import com.regulaone.backend.models.Tenant;
import com.regulaone.backend.models.TenantModule;
import com.regulaone.backend.models.TenantStatus;
import com.regulaone.backend.models.User;
import com.regulaone.backend.repository.TenantRepository;
import com.regulaone.backend.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Builds the RegulaOne SuperAdmin "Platform Overview": how the BUSINESS is doing,
 * across every customer company.
 *
 * It is the third of the three dashboards, and the only one that looks across
 * customers. Read {@link PlatformOverviewResponse} first — it states the rule that
 * shapes this whole class: RegulaOne is a PROCESSOR of its customers' personal data,
 * so this service reads the platform's OWN commercial collections ({@code tenants},
 * {@code users}) and never touches the six modules' collections.
 *
 * ── WHAT CHANGED FROM THE PREVIOUS VERSION, AND WHY ─────────────────────────────
 *
 *   1. CURRENCY IS RESPECTED. Plan prices carry an ISO-4217 currency and the old code
 *      ignored it, adding PLN and EUR amounts into one BigDecimal. Money is now
 *      grouped by currency everywhere.
 *
 *   2. THE INVENTED "COMPLIANCE SCORE" IS GONE, replaced by four real subscription
 *      counts. See {@link Plans} for the full reasoning.
 *
 *   3. USERS ARE COUNTED IN THE DATABASE. The old code called
 *      {@code userRepository.findAll()} and counted in Java, pulling every user
 *      document on the platform — names, e-mails, permission lists — into memory to
 *      produce four integers. Counting server-side means the personal data never
 *      leaves MongoDB, and the work no longer grows with the user base.
 *
 *   4. MODULE ADOPTION HAS A STATED DENOMINATOR (active customers) instead of "share
 *      of the most popular module", which forced the leading module to 100%.
 *
 *   5. MONTHS ARE SENT AS "YYYY-MM", not "Jan". The old code formatted month names
 *      with {@code Locale.ENGLISH} on the server, which pinned the chart to English
 *      on a Polish-first product.
 *
 *   6. THE READ IS AUDITED, by the controller. A platform operator looking across
 *      every customer account is exactly the access that has to leave a trace.
 *
 * ── WHY TENANTS ARE STILL READ WHOLE ────────────────────────────────────────────
 *
 * {@code tenantRepository.findAll()} stays, on purpose. The plan, its price, its
 * currency, its seat limit, its dates and the whole billing ledger are all embedded
 * in the tenant document, and the revenue series needs to walk that ledger. Tenants
 * are customer companies, so the collection is bounded by how many customers the
 * business has — hundreds, not millions — whereas users are not bounded that way.
 * That asymmetry is why one is loaded and the other is counted in the database.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PlatformService {

    private static final String USERS = "users";

    /** How many months of billing history the chart shows. */
    private static final int REVENUE_MONTHS = 6;

    /** A plan inside this many days is "expiring soon" — same window as the other dashboards. */
    private static final int EXPIRY_WARNING_DAYS = 30;

    /** Longest watchlist returned, so one bad import cannot produce a thousand rows. */
    private static final int WATCHLIST_LIMIT = 25;

    /** All dates are judged in Polish local time — the market this product serves. */
    private static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");

    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;
    private final MongoTemplate mongo;

    /**
     * Assemble the platform overview and record that it was read.
     *
     * @param cognitoSub the subject claim of the verified session token — used only to
     *                   name the operator in the audit trail
     * @param request    the live HTTP request, used solely to stamp the audit entry
     */
    public PlatformOverviewResponse getPlatformOverview(String cognitoSub,
                                                       HttpServletRequest request) {

        PlatformOverviewResponse overview = getPlatformOverview();

        // ── Record the read ────────────────────────────────────────────────────
        // A platform operator looking across EVERY customer account is exactly the
        // access a data-processing agreement obliges us to be able to evidence
        // (GDPR Art. 5(2), Art. 28). tenantId is deliberately null: the read belongs
        // to no single customer, and that is what marks it platform-wide in the trail.
        User operator = userRepository.findByCognitoSub(cognitoSub).orElse(null);

        auditLogService.record(
                null,
                operator != null ? operator.getId() : null,
                operator != null ? operator.getEmail() : null,
                operator != null && operator.getRole() != null
                        ? operator.getRole().name()
                        : "ROLE_SUPER_ADMIN",
                "PLATFORM_OVERVIEW_VIEWED",
                "PLATFORM_OVERVIEW",
                null,
                // The scope actually returned, so the trail shows WHAT was summarised
                // rather than merely that a page was opened.
                List.of("tenants=" + overview.tenants().total(),
                        "watchlist=" + overview.watchlist().size()),
                request);

        return overview;
    }

    /**
     * The figures themselves, with no audit write.
     *
     * Kept separate so tests can build the snapshot without appending to the audit
     * trail, and so a future internal caller (a scheduled report, say) can reuse the
     * computation without pretending a person opened the screen.
     */
    public PlatformOverviewResponse getPlatformOverview() {

        LocalDateTime now = LocalDateTime.now(WARSAW);
        LocalDateTime startOfThisMonth = now.withDayOfMonth(1).toLocalDate().atStartOfDay();
        LocalDateTime startOfLastMonth = startOfThisMonth.minusMonths(1);

        // Customer companies, read whole — see the class note for why.
        List<Tenant> allTenants = tenantRepository.findAll();

        // ── The customer base ──────────────────────────────────────────────────
        long active = countByStatus(allTenants, TenantStatus.ACTIVE);
        long suspended = countByStatus(allTenants, TenantStatus.SUSPENDED);
        long inactive = countByStatus(allTenants, TenantStatus.INACTIVE);

        long tenantsThisMonth = countCreatedBetween(allTenants, startOfThisMonth, null);
        long tenantsLastMonth = countCreatedBetween(allTenants, startOfLastMonth, startOfThisMonth);

        PlatformOverviewResponse.Tenants tenants = new PlatformOverviewResponse.Tenants(
                allTenants.size(), active, suspended, inactive,
                tenantsThisMonth, tenantsLastMonth,
                growthTrend(tenantsLastMonth, tenantsThisMonth));

        // ── Seats, counted in the database ─────────────────────────────────────
        Seats seats = buildSeats(allTenants, startOfThisMonth, startOfLastMonth);

        // ── Money, always per currency ─────────────────────────────────────────
        List<Money> monthlyRecurring = buildMonthlyRecurring(allTenants, now);
        List<CurrencySeries> billingsByMonth = buildBillings(allTenants, startOfThisMonth);

        // ── Subscription state (what replaced the "compliance score") ──────────
        Plans plans = buildPlans(allTenants, now);

        // ── Module take-up ────────────────────────────────────────────────────
        List<ModuleAdoption> moduleAdoption = buildModuleAdoption(allTenants, active);

        // ── Who needs a phone call ────────────────────────────────────────────
        List<WatchItem> watchlist = buildWatchlist(allTenants, now);

        return new PlatformOverviewResponse(
                tenants, seats, monthlyRecurring, billingsByMonth,
                plans, moduleAdoption, watchlist,
                java.time.Instant.now());
    }

    // ── The customer base ───────────────────────────────────────────────────────

    private long countByStatus(List<Tenant> allTenants, TenantStatus status) {
        return allTenants.stream().filter(t -> t.getStatus() == status).count();
    }

    /**
     * How many companies were created in a window. {@code to} of null means "up to
     * now", which is what the current month needs.
     */
    private long countCreatedBetween(List<Tenant> allTenants, LocalDateTime from, LocalDateTime to) {
        return allTenants.stream()
                .filter(t -> t.getCreatedAt() != null)
                .filter(t -> !t.getCreatedAt().isBefore(from))
                .filter(t -> to == null || t.getCreatedAt().isBefore(to))
                .count();
    }

    // ── Seats ───────────────────────────────────────────────────────────────────

    /**
     * People against paid capacity.
     *
     * The four user figures are four {@code countDocuments} calls, so no user document
     * is transferred. The seat capacity comes from the tenant documents already in
     * memory.
     */
    private Seats buildSeats(List<Tenant> allTenants,
                             LocalDateTime startOfThisMonth,
                             LocalDateTime startOfLastMonth) {

        long enabled = mongo.count(Query.query(Criteria.where("enabled").is(true)), USERS);
        long disabled = mongo.count(Query.query(Criteria.where("enabled").ne(true)), USERS);

        long newThisMonth = mongo.count(Query.query(
                Criteria.where("createdAt").gte(toDate(startOfThisMonth))), USERS);

        long newLastMonth = mongo.count(Query.query(
                Criteria.where("createdAt").gte(toDate(startOfLastMonth))
                        .lt(toDate(startOfThisMonth))), USERS);

        // Seat limits are only meaningful for customers whose account is live.
        long contracted = 0;
        boolean anyLimitDeclared = false;
        for (Tenant tenant : allTenants) {
            if (tenant.getStatus() != TenantStatus.ACTIVE) continue;
            Integer capacity = seatLimitOf(tenant);
            if (capacity != null) {
                contracted += capacity;
                anyLimitDeclared = true;
            }
        }

        // Null rather than 0 when nobody declared a limit — a 0 would read as
        // "no seats sold", which is a different statement from "not stated".
        Long seatsContracted = anyLimitDeclared ? contracted : null;
        Integer utilisation = (seatsContracted != null && seatsContracted > 0)
                ? (int) Math.round(enabled * 100.0 / seatsContracted)
                : null;

        return new Seats(enabled, disabled, newThisMonth, newLastMonth,
                growthTrend(newLastMonth, newThisMonth), seatsContracted, utilisation);
    }

    /**
     * The seat limit on a tenant's live plan.
     *
     * {@code usersCapacity} is stored as free text on the tenant, so a non-numeric or
     * blank value is treated as "not stated" rather than being allowed to break the
     * whole dashboard. The package's own limit is used as the fallback.
     */
    private Integer seatLimitOf(Tenant tenant) {
        Tenant.PackageDetails current = tenant.getCurrentPackage();
        if (current == null) return null;

        if (current.getUsersCapacity() != null && !current.getUsersCapacity().isBlank()) {
            try {
                return Integer.valueOf(current.getUsersCapacity().trim());
            } catch (NumberFormatException ex) {
                log.debug("[platform-overview] tenant {} has a non-numeric seat limit '{}'",
                        tenant.getId(), current.getUsersCapacity());
            }
        }
        return current.getAppPackage() != null ? current.getAppPackage().getUsersCapacity() : null;
    }

    // ── Money ───────────────────────────────────────────────────────────────────

    /**
     * What the live plans are worth per month, grouped by currency.
     *
     * A plan is counted when the customer is ACTIVE and the plan has not lapsed. Prices
     * are NOT converted between currencies: this service holds no exchange rate, and
     * inventing one would turn a billing figure into an estimate.
     */
    private List<Money> buildMonthlyRecurring(List<Tenant> allTenants, LocalDateTime now) {
        Map<String, BigDecimal> byCurrency = new TreeMap<>();

        for (Tenant tenant : allTenants) {
            if (tenant.getStatus() != TenantStatus.ACTIVE) continue;

            Tenant.PackageDetails current = tenant.getCurrentPackage();
            if (current == null || current.getAppPackage() == null) continue;

            // A lapsed plan is not recurring revenue, even on an active account.
            if (current.getPlanExpiring() != null && current.getPlanExpiring().isBefore(now)) continue;

            AppPackage pkg = current.getAppPackage();
            if (pkg.getPrice() == null) continue;

            byCurrency.merge(currencyOf(pkg), pkg.getPrice(), BigDecimal::add);
        }

        return byCurrency.entrySet().stream()
                .map(e -> new Money(e.getKey(), e.getValue()))
                .toList();
    }

    /**
     * What was billed in each of the last {@link #REVENUE_MONTHS} months, per currency.
     *
     * The source is each tenant's {@code packageHistory}, which PackageService keeps as
     * a billing ledger: one entry per paid period, stamped with the date the period
     * STARTED. So this series is "value billed in that month" — the same quantity the
     * previous version computed. What changed is that it is now split by currency, the
     * months are machine values, and it is named for what it is instead of being
     * presented as the recurring figure. See {@link CurrencySeries}.
     */
    private List<CurrencySeries> buildBillings(List<Tenant> allTenants,
                                               LocalDateTime startOfThisMonth) {

        // currency → ("YYYY-MM" → amount). LinkedHashMap keeps the months in order.
        Map<String, Map<String, BigDecimal>> byCurrency = new TreeMap<>();

        // Pre-seed every month so a currency with a quiet month reports 0 rather than
        // dropping the point and making the chart lie about the shape.
        List<String> monthKeys = new ArrayList<>();
        for (int back = REVENUE_MONTHS - 1; back >= 0; back--) {
            monthKeys.add(YearMonth.from(startOfThisMonth.minusMonths(back)).toString());
        }

        LocalDateTime windowStart = startOfThisMonth.minusMonths(REVENUE_MONTHS - 1L);

        for (Tenant tenant : allTenants) {
            if (tenant.getPackageHistory() == null) continue;

            for (Tenant.PackageHistory period : tenant.getPackageHistory()) {
                if (period.getPlanStarted() == null || period.getAppPackage() == null) continue;
                if (period.getAppPackage().getPrice() == null) continue;

                // Only the months on the chart.
                if (period.getPlanStarted().isBefore(windowStart)) continue;

                String monthKey = YearMonth.from(period.getPlanStarted()).toString();
                if (!monthKeys.contains(monthKey)) continue;

                byCurrency
                        .computeIfAbsent(currencyOf(period.getAppPackage()), c -> seedMonths(monthKeys))
                        .merge(monthKey, period.getAppPackage().getPrice(), BigDecimal::add);
            }
        }

        List<CurrencySeries> series = new ArrayList<>();
        for (Map.Entry<String, Map<String, BigDecimal>> entry : byCurrency.entrySet()) {
            List<MonthPoint> points = entry.getValue().entrySet().stream()
                    .map(m -> new MonthPoint(m.getKey(), m.getValue()))
                    .toList();

            // The trend compares the last two months OF THIS CURRENCY only, so a
            // strong month in one currency cannot flatter another.
            BigDecimal previous = points.size() >= 2 ? points.get(points.size() - 2).value() : null;
            BigDecimal latest = points.isEmpty() ? null : points.get(points.size() - 1).value();

            series.add(new CurrencySeries(entry.getKey(), amountTrend(previous, latest), points));
        }
        return series;
    }

    /** An ordered month → 0 map, so every currency reports every month on the chart. */
    private Map<String, BigDecimal> seedMonths(List<String> monthKeys) {
        Map<String, BigDecimal> months = new LinkedHashMap<>();
        monthKeys.forEach(key -> months.put(key, BigDecimal.ZERO));
        return months;
    }

    /**
     * A package's currency, defaulting to PLN.
     *
     * PLN is the right default for a product built for the Polish market: an older
     * package row saved before the currency field existed is far more likely to be a
     * złoty price than anything else. The default is applied HERE, in one place, so
     * amounts can never be grouped under an empty currency key.
     */
    private String currencyOf(AppPackage pkg) {
        String currency = pkg.getCurrency();
        return (currency == null || currency.isBlank()) ? "PLN" : currency.trim().toUpperCase();
    }

    // ── Subscription state ──────────────────────────────────────────────────────

    /** Who is paid up, who lapsed, who is about to, and who never had a plan. */
    private Plans buildPlans(List<Tenant> allTenants, LocalDateTime now) {
        LocalDateTime warningEdge = now.plusDays(EXPIRY_WARNING_DAYS);

        long valid = 0;
        long expired = 0;
        long expiringSoon = 0;
        long noPlan = 0;

        for (Tenant tenant : allTenants) {
            Tenant.PackageDetails current = tenant.getCurrentPackage();

            if (current == null || current.getAppPackage() == null) {
                noPlan++;
                continue;
            }

            LocalDateTime expiry = current.getPlanExpiring();

            // No expiry date means an open-ended plan, which is valid, not lapsed.
            if (expiry == null) {
                valid++;
            } else if (expiry.isBefore(now)) {
                expired++;
            } else {
                valid++;
                // Counted in BOTH valid and expiringSoon on purpose: the plan still
                // works today, and it still needs a renewal call this month.
                if (expiry.isBefore(warningEdge)) expiringSoon++;
            }
        }

        return new Plans(valid, expired, expiringSoon, noPlan);
    }

    // ── Module take-up ──────────────────────────────────────────────────────────

    /**
     * How far each module has been taken up: how many customers BOUGHT it, and how
     * many people were actually GRANTED it.
     *
     * The two come from different places on purpose. Entitlement lives on the tenant's
     * plan (already in memory); grants live on the user documents and are counted with
     * a single aggregation, so no user document is transferred.
     */
    private List<ModuleAdoption> buildModuleAdoption(List<Tenant> allTenants, long activeTenants) {

        Map<String, Long> grantsByModule = countModuleGrants();

        List<ModuleAdoption> adoption = new ArrayList<>();
        for (TenantModule module : TenantModule.values()) {

            long entitled = allTenants.stream()
                    .filter(t -> t.getStatus() == TenantStatus.ACTIVE)
                    .filter(t -> planIncludes(t, module))
                    .count();

            // The denominator is stated: active customers. When there are none the
            // share is 0 rather than a division by zero.
            int pct = activeTenants == 0 ? 0 : (int) Math.round(entitled * 100.0 / activeTenants);

            adoption.add(new ModuleAdoption(module.name(), entitled, pct,
                    grantsByModule.getOrDefault(module.name(), 0L)));
        }
        return adoption;
    }

    /** Does this tenant's live plan include the module? */
    private boolean planIncludes(Tenant tenant, TenantModule module) {
        Tenant.PackageDetails current = tenant.getCurrentPackage();
        return current != null
                && current.getAppPackage() != null
                && current.getAppPackage().getAppIds() != null
                && current.getAppPackage().getAppIds().contains(module);
    }

    /**
     * How many enabled users hold each module, counted inside MongoDB.
     *
     * One aggregation replaces the old six-passes-over-every-user-in-Java loop:
     * unwind the moduleIds array, group by module, count. Only the six resulting
     * pairs come back.
     */
    private Map<String, Long> countModuleGrants() {
        List<Document> pipeline = List.of(
                new Document("$match", new Document("enabled", true)),
                new Document("$unwind", "$moduleIds"),
                new Document("$group", new Document("_id", "$moduleIds")
                        .append("users", new Document("$sum", 1))));

        Map<String, Long> counts = new LinkedHashMap<>();
        try {
            mongo.getCollection(USERS).aggregate(pipeline)
                    .forEach(row -> {
                        Object id = row.get("_id");
                        if (id != null) counts.put(String.valueOf(id), asLong(row.get("users")));
                    });
        } catch (RuntimeException ex) {
            // A failure here must not cost the operator the whole screen; the bars
            // simply show entitlement without grants.
            log.warn("[platform-overview] module grant counts unavailable: {}", ex.getMessage());
        }
        return counts;
    }

    // ── Watchlist ───────────────────────────────────────────────────────────────

    /**
     * The customers who need attention, worst first.
     *
     * Only commercial facts: a plan date, an account status, a seat count. Nothing is
     * read out of the customers' module data — see the note at the top of
     * {@link PlatformOverviewResponse}.
     */
    private List<WatchItem> buildWatchlist(List<Tenant> allTenants, LocalDateTime now) {
        List<WatchItem> items = new ArrayList<>();
        LocalDate today = now.toLocalDate();

        for (Tenant tenant : allTenants) {
            String name = tenant.getName() != null ? tenant.getName() : tenant.getId();

            // A suspended account cannot use the platform — the most urgent state.
            if (tenant.getStatus() == TenantStatus.SUSPENDED) {
                items.add(new WatchItem(tenant.getId(), name, "TENANT_SUSPENDED",
                        "RISK", null, null));
            }

            Tenant.PackageDetails current = tenant.getCurrentPackage();

            // Only chase a missing plan on an account that is otherwise live; an
            // INACTIVE customer having no plan is expected, not a problem to fix.
            if ((current == null || current.getAppPackage() == null)) {
                if (tenant.getStatus() == TenantStatus.ACTIVE) {
                    items.add(new WatchItem(tenant.getId(), name, "NO_PLAN", "RISK", null, null));
                }
                continue;
            }

            LocalDateTime expiry = current.getPlanExpiring();
            if (expiry != null) {
                int daysLeft = (int) ChronoUnit.DAYS.between(today, expiry.toLocalDate());

                if (expiry.isBefore(now)) {
                    items.add(new WatchItem(tenant.getId(), name, "PLAN_EXPIRED", "RISK",
                            daysLeft, planNameOf(current)));
                } else if (daysLeft <= EXPIRY_WARNING_DAYS) {
                    items.add(new WatchItem(tenant.getId(), name, "PLAN_EXPIRING", "WARN",
                            daysLeft, planNameOf(current)));
                }
            }

            // More people enabled than seats bought — a billing conversation.
            Integer capacity = seatLimitOf(tenant);
            if (capacity != null && capacity > 0 && tenant.getStatus() == TenantStatus.ACTIVE) {
                long enabledHere = countEnabledUsersOf(tenant.getId());
                if (enabledHere > capacity) {
                    items.add(new WatchItem(tenant.getId(), name, "SEATS_EXCEEDED", "WARN",
                            null, enabledHere + " / " + capacity));
                }
            }
        }

        // Worst first, then the nearest deadline, then a stable name order so repeated
        // loads do not reshuffle the table.
        items.sort(Comparator
                .comparingInt((WatchItem item) -> "RISK".equals(item.tone()) ? 0 : 1)
                .thenComparing(item -> item.daysRemaining() == null
                        ? Integer.MAX_VALUE : item.daysRemaining())
                .thenComparing(WatchItem::tenantName,
                        Comparator.nullsLast(Comparator.naturalOrder())));

        if (items.size() > WATCHLIST_LIMIT) {
            log.info("[platform-overview] watchlist truncated from {} to {} items",
                    items.size(), WATCHLIST_LIMIT);
            return List.copyOf(items.subList(0, WATCHLIST_LIMIT));
        }
        return items;
    }

    private String planNameOf(Tenant.PackageDetails current) {
        return current.getAppPackage() != null ? current.getAppPackage().getName() : null;
    }

    /**
     * How many enabled users one customer has.
     *
     * Counted in the database, and only for the few tenants that actually declare a
     * seat limit, so this stays a handful of counts rather than a scan. The DBRef to
     * the tenant is stored as the nested "tenant.$id" field, which is why the query
     * looks like this.
     */
    private long countEnabledUsersOf(String tenantId) {
        try {
            return mongo.getCollection(USERS).countDocuments(
                    new Document("enabled", true)
                            .append("tenant.$id", new org.bson.types.ObjectId(tenantId)));
        } catch (RuntimeException ex) {
            log.debug("[platform-overview] could not count users of tenant {}: {}",
                    tenantId, ex.getMessage());
            return 0;
        }
    }

    // ── Shared helpers ──────────────────────────────────────────────────────────

    /**
     * Change between two counts, as a short display string.
     *
     * Kept as text rather than a number because "New" (there was nothing before) and
     * "—" (there is still nothing) are not percentages, and the screen has to show
     * something honest in both cases.
     */
    String growthTrend(long previous, long current) {
        if (previous == 0) return current > 0 ? "New" : "—";

        double pct = (current - previous) * 100.0 / previous;
        if (Math.abs(pct) < 1) return "steady";

        return (pct > 0 ? "+" : "") + String.format("%.0f%%", pct);
    }

    /** The same idea for money. Null and zero are handled before dividing. */
    String amountTrend(BigDecimal previous, BigDecimal current) {
        if (previous == null || previous.compareTo(BigDecimal.ZERO) == 0) {
            return (current != null && current.compareTo(BigDecimal.ZERO) > 0) ? "New" : "—";
        }
        if (current == null) return "—";

        BigDecimal pct = current.subtract(previous)
                .divide(previous, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));

        if (pct.abs().compareTo(BigDecimal.valueOf(2)) < 0) return "steady";

        return (pct.compareTo(BigDecimal.ZERO) > 0 ? "+" : "")
                + pct.setScale(0, RoundingMode.HALF_UP) + "%";
    }

    /** Java time → the Date form MongoDB stores for a LocalDateTime field. */
    private static Date toDate(LocalDateTime value) {
        return Date.from(value.atZone(WARSAW).toInstant());
    }

    private static long asLong(Object value) {
        return value instanceof Number number ? number.longValue() : 0L;
    }
}
