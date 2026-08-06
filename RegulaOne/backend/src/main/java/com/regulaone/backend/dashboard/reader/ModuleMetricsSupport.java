package com.regulaone.backend.dashboard.reader;

import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Date;
import java.util.List;

/**
 * Shared read-only helpers for the six module readers.
 *
 * WHY THE MODULES ARE READ DIRECTLY FROM MONGODB
 *   All seven RegulaOne services (this one plus the six compliance modules) run
 *   against the SAME MongoDB database, each owning its own collections. The
 *   dashboard therefore reads the module collections directly instead of calling
 *   six HTTP APIs. Reasons:
 *     * The dashboard keeps working when a module process is down — one dead
 *       service cannot blank the whole compliance overview.
 *     * No new service-to-service tokens or six sets of module code changes.
 *     * Counting inside the database moves far less data than fetching lists.
 *   This follows a pattern the platform already uses (SafeWorkEmployeeStubRepository
 *   writes a SafeWork collection; SafeVoice and PrivacyPilot read the shared
 *   "tenants" collection).
 *
 * THE RULES EVERY READER MUST FOLLOW
 *   1. READ ONLY. Nothing in this package ever writes to a module's collection —
 *      each module stays the sole owner of its own data.
 *   2. ALWAYS FILTER BY TENANT. Every query starts from {@link #tenant(String)}
 *      (or, for SafeWork, a join through the tenant's own user ids), so one
 *      company can never be shown another company's numbers.
 *   3. COUNT, DO NOT COLLECT. Prefer count/aggregate queries over loading
 *      documents, so personal data never leaves the database in the first place.
 *
 * Dates: the modules are a mix of Java (LocalDateTime / Instant) and Node
 * (JavaScript Date) services, but MongoDB stores all of them as one BSON date
 * type. Reading them back as {@link Date} therefore works for every module, which
 * is why {@link #instant(Object)} exists.
 */
@RequiredArgsConstructor
public abstract class ModuleMetricsSupport {

    /** Company-local time zone. Poland is the platform's primary market. */
    protected static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");

    /** Documents/certificates inside this many days of expiry count as "expiring soon". */
    protected static final int EXPIRY_WARNING_DAYS = 30;

    protected final MongoTemplate mongo;

    // ── Query building ──────────────────────────────────────────────────────────

    /**
     * The starting filter for EVERY module query: this tenant only.
     * All six modules store the RegulaOne tenant id in a plain "tenantId" field.
     */
    protected static Criteria tenant(String tenantId) {
        return Criteria.where("tenantId").is(tenantId);
    }

    /** Count documents in a collection that match a filter. Uses the collection's indexes. */
    protected long count(String collection, Criteria criteria) {
        return mongo.count(Query.query(criteria), collection);
    }

    /**
     * Run an aggregation pipeline and return the first result document, or an
     * empty document when the pipeline matched nothing. Used for the "$group /
     * $facet" style queries that add up totals in one round trip.
     */
    protected Document aggregateOne(String collection, List<Document> pipeline) {
        Document first = mongo.getCollection(collection)
                .aggregate(pipeline)
                .first();
        return first != null ? first : new Document();
    }

    /** Run an aggregation pipeline and return every result row. */
    protected List<Document> aggregate(String collection, List<Document> pipeline) {
        return mongo.getCollection(collection)
                .aggregate(pipeline)
                .into(new java.util.ArrayList<>());
    }

    // ── Reading values safely out of raw BSON ───────────────────────────────────

    /**
     * Read a number that MongoDB may have stored as an int, long, double or
     * Decimal128 (money and weights vary by module) and always hand back a long.
     * Missing or non-numeric values become 0 instead of throwing.
     */
    protected static long asLong(Object value) {
        if (value instanceof Number n) return n.longValue();
        if (value instanceof org.bson.types.Decimal128 d) return d.bigDecimalValue().longValue();
        return 0L;
    }

    /** Same as {@link #asLong(Object)} but keeps the fractional part (kilograms, money). */
    protected static double asDouble(Object value) {
        if (value instanceof Number n) return n.doubleValue();
        if (value instanceof org.bson.types.Decimal128 d) return d.bigDecimalValue().doubleValue();
        return 0d;
    }

    /** Read a BSON date as an {@link Instant}; null when absent or of another type. */
    protected static Instant instant(Object value) {
        if (value instanceof Date d) return d.toInstant();
        return null;
    }

    // ── Time windows the legal clocks are measured against ──────────────────────

    /** Midnight this morning, Warsaw time — the boundary for "today" figures. */
    protected static Date startOfToday() {
        return Date.from(LocalDate.now(WARSAW).atStartOfDay(WARSAW).toInstant());
    }

    /** Midnight on the 1st of the current month, Warsaw time. */
    protected static Date startOfThisMonth() {
        return Date.from(LocalDate.now(WARSAW).withDayOfMonth(1).atStartOfDay(WARSAW).toInstant());
    }

    /** A point {@code days} in the past, used for rolling windows (e.g. last 30 days). */
    protected static Date daysAgo(int days) {
        return Date.from(Instant.now().minusSeconds(days * 86_400L));
    }

    /** A point {@code days} in the future, used for expiry warnings. */
    protected static Date daysAhead(int days) {
        return Date.from(Instant.now().plusSeconds(days * 86_400L));
    }

    /** Right now, as a BSON-comparable date. */
    protected static Date now() {
        return Date.from(Instant.now());
    }

    // ── Fields that hold a CALENDAR DAY rather than a timestamp ─────────────────
    //
    // WHY THESE EXIST — a real trap found while wiring the dashboard up:
    //   Fields typed as a Java LocalDate (a day with no time), such as a KSeF
    //   certificate's validTo, are written to MongoDB as the TEXT "2027-04-30",
    //   while fields typed as LocalDateTime/Instant/JS Date are written as a BSON
    //   date. MongoDB compares values of different types by type order, so asking
    //   "validTo < <a date>" against text NEVER matches — the query silently
    //   returns nothing. On a compliance dashboard that is the worst kind of bug:
    //   an expired certificate would quietly report as fine.
    //
    // The helpers below therefore match EITHER storage form. ISO "YYYY-MM-DD" text
    // sorts alphabetically in the same order as it does chronologically, so the
    // text comparison is exact, not an approximation.

    /** A day field whose value is on or after {@code day} (still valid). */
    protected static Criteria dayOnOrAfter(String field, LocalDate day) {
        return new Criteria().orOperator(
                Criteria.where(field).gte(day.toString()),
                Criteria.where(field).gte(startOfDay(day)));
    }

    /** A day field whose value is before {@code day} (already past). */
    protected static Criteria dayBefore(String field, LocalDate day) {
        return new Criteria().orOperator(
                Criteria.where(field).lt(day.toString()),
                Criteria.where(field).lt(startOfDay(day)));
    }

    /** A day field inside the half-open window [from, to) — used for expiry warnings. */
    protected static Criteria dayBetween(String field, LocalDate from, LocalDate to) {
        return new Criteria().orOperator(
                Criteria.where(field).gte(from.toString()).lt(to.toString()),
                Criteria.where(field).gte(startOfDay(from)).lt(startOfDay(to)));
    }

    /** Midnight on the given day, Warsaw time. */
    protected static Date startOfDay(LocalDate day) {
        return Date.from(day.atStartOfDay(WARSAW).toInstant());
    }

    /**
     * Read a day field back as text, whatever form it was stored in, so it can be
     * shown as a plain "YYYY-MM-DD" value in the API.
     */
    protected static String asIsoDay(Object value) {
        if (value instanceof String s) return s;
        Instant at = instant(value);
        return at == null ? null : at.atZone(WARSAW).toLocalDate().toString();
    }

    // ── Small formatting helpers ────────────────────────────────────────────────

    /**
     * Turn "how many of a total" into a whole percentage. An empty total reports
     * 100 %, because when there is nothing to check nothing can be wrong.
     */
    protected static int percent(long part, long total) {
        if (total <= 0) return 100;
        return (int) Math.round(part * 100.0 / total);
    }

    /** Whole hours from minutes, one decimal place, as plain text for the API. */
    protected static String hours(long minutes) {
        return String.format(java.util.Locale.ROOT, "%.1f", minutes / 60.0);
    }

    /** Kilograms with one decimal place, as plain text for the API. */
    protected static String kilograms(double kg) {
        return String.format(java.util.Locale.ROOT, "%.1f", kg);
    }
}
