package com.regulaone.backend.repository.modules;

import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.AttentionItem;
import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.Metric;
import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.MonthPoint;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Reads the KSeFFlow (Polish e-invoicing) numbers for one company.
 *
 * WHAT KSeFFlow DOES: it sends every sales invoice to KSeF, the Polish
 * government's National e-Invoice System, and stores the UPO — the official
 * government receipt proving the invoice was accepted.
 *
 * WHAT THIS READER WATCHES, AND WHY IT MATTERS LEGALLY:
 *   * Invoices that failed or are stuck offline. An invoice that never reaches
 *     KSeF is, in law, not properly issued.
 *   * Invoices past their KSeF submission deadline. When KSeF is unreachable the
 *     invoice may be issued offline, but it must still be uploaded within the
 *     legal window (ustawa o VAT art. 106nf–106nh). Missing that window is a real
 *     tax exposure, so it is reported as a RISK.
 *   * Accepted invoices with no stored UPO. The UPO is the proof of filing and
 *     must be kept for the statutory retention period (ustawa o VAT art. 112).
 *   * The KSeF certificate. Without a valid authentication certificate the
 *     company simply cannot talk to KSeF, so nothing can be filed at all.
 *
 * Only counts and money totals are read — never buyer names or invoice contents.
 */
@Repository
public class KsefFlowMetricsReader extends ModuleMetricsSupport {

    private static final String INVOICES = "ksef_invoices";
    private static final String CERTIFICATES = "ksef_certificates";

    // Where the dashboard sends the admin to act on KSeF work.
    private static final String ROUTE = "/modules/ksef";

    // Legal sources, kept in one place so the same wording appears everywhere.
    private static final String LAW_OFFLINE_DEADLINE = "Ustawa o VAT art. 106nf–106nh (tryb offline)";
    private static final String LAW_INVOICE_RETENTION = "Ustawa o VAT art. 112 (przechowywanie / UPO)";
    private static final String LAW_KSEF_MANDATE = "Ustawa o VAT art. 106na–106nf (KSeF)";

    public KsefFlowMetricsReader(MongoTemplate mongo) {
        super(mongo);
    }

    public ModuleSnapshot read(String tenantId) {
        List<Metric> metrics = new ArrayList<>();
        List<AttentionItem> attention = new ArrayList<>();

        // Soft-deleted invoices are kept for the 10-year retention rule but must
        // never be counted as live work, so every filter excludes them.
        Criteria live = tenant(tenantId).and("softDeleted").ne(true);

        long total = count(INVOICES, live);
        long draft = countStatus(tenantId, "DRAFT");
        long pending = countStatus(tenantId, "PENDING");
        long sent = countStatus(tenantId, "SENT");
        long failed = countStatus(tenantId, "FAILED");
        long offline = countStatus(tenantId, "OFFLINE_MODE");
        long retrying = countStatus(tenantId, "RETRYING");

        // "Submitted" excludes drafts — a draft was never sent, so counting it
        // would unfairly drag the acceptance rate down.
        long submitted = total - draft;
        int acceptanceRate = submitted > 0 ? percent(sent, submitted) : 100;

        // Invoices whose legal upload deadline has already passed while the
        // invoice is still not accepted by KSeF. This is the single most serious
        // KSeF figure on the dashboard.
        long deadlineBreached = count(INVOICES, tenant(tenantId)
                .and("softDeleted").ne(true)
                .and("status").ne("SENT")
                .and("ksefSubmissionDeadline").lt(now()));

        // Accepted invoices where the government receipt was never stored.
        // NONE / GENERATED both mean "we do not hold the UPO document yet".
        long upoMissing = count(INVOICES, tenant(tenantId)
                .and("softDeleted").ne(true)
                .and("status").is("SENT")
                .and("upoStatus").in("NONE", "GENERATED"));

        long issuedThisMonth = count(INVOICES, tenant(tenantId)
                .and("softDeleted").ne(true)
                .and("status").ne("DRAFT")
                .and("createdAt").gte(startOfThisMonth()));

        metrics.add(Metric.count("ksef.invoices.total", total));
        metrics.add(Metric.count("ksef.invoices.issuedThisMonth", issuedThisMonth));
        metrics.add(Metric.count("ksef.invoices.draft", draft));
        metrics.add(Metric.count("ksef.invoices.pending", pending));
        metrics.add(Metric.count("ksef.invoices.sent", sent, "GOOD", LAW_KSEF_MANDATE));
        metrics.add(Metric.count("ksef.invoices.failed", failed,
                failed > 0 ? "RISK" : "GOOD", LAW_KSEF_MANDATE));
        metrics.add(Metric.count("ksef.invoices.offlineQueued", offline + retrying,
                (offline + retrying) > 0 ? "WARN" : "GOOD", LAW_OFFLINE_DEADLINE));
        metrics.add(Metric.count("ksef.invoices.deadlineBreached", deadlineBreached,
                deadlineBreached > 0 ? "RISK" : "GOOD", LAW_OFFLINE_DEADLINE));
        metrics.add(Metric.count("ksef.upo.missing", upoMissing,
                upoMissing > 0 ? "WARN" : "GOOD", LAW_INVOICE_RETENTION));
        metrics.add(new Metric("ksef.invoices.acceptanceRate", Integer.toString(acceptanceRate),
                "PERCENT", acceptanceRate >= 100 ? "GOOD" : acceptanceRate >= 95 ? "WARN" : "RISK",
                LAW_KSEF_MANDATE));

        // Money issued this year, per currency. Currencies are reported
        // separately and never converted: PLN is the legal reporting currency for
        // Polish VAT, and inventing an exchange rate would falsify the figure.
        addYearTotals(tenantId, metrics);

        // ── Certificate health ─────────────────────────────────────────────────
        addCertificateMetrics(tenantId, metrics, attention);

        // ── Attention list ─────────────────────────────────────────────────────
        if (deadlineBreached > 0) {
            attention.add(new AttentionItem("KSEFFLOW", "KSEF_SUBMISSION_DEADLINE_BREACHED",
                    (int) deadlineBreached, "RISK", LAW_OFFLINE_DEADLINE, ROUTE));
        }
        if (failed > 0) {
            attention.add(new AttentionItem("KSEFFLOW", "KSEF_INVOICES_FAILED",
                    (int) failed, "RISK", LAW_KSEF_MANDATE, ROUTE));
        }
        if (offline + retrying > 0) {
            attention.add(new AttentionItem("KSEFFLOW", "KSEF_OFFLINE_QUEUE",
                    (int) (offline + retrying), "WARN", LAW_OFFLINE_DEADLINE, ROUTE));
        }
        if (upoMissing > 0) {
            attention.add(new AttentionItem("KSEFFLOW", "KSEF_UPO_MISSING",
                    (int) upoMissing, "WARN", LAW_INVOICE_RETENTION, ROUTE));
        }

        return new ModuleSnapshot(metrics, attention);
    }

    /**
     * Invoice count per calendar month for the last 12 months, oldest first.
     * Months with no invoices are returned as zero so the chart has no gaps.
     * Drafts are excluded — they are not issued documents.
     */
    public List<MonthPoint> invoiceVolume(String tenantId, int months) {
        Date from = Date.from(LocalDate.now(WARSAW)
                .withDayOfMonth(1)
                .minusMonths(months - 1L)
                .atStartOfDay(WARSAW)
                .toInstant());

        // Group in the database by "YYYY-MM" so only 12 tiny rows come back.
        List<Document> pipeline = List.of(
                new Document("$match", new Document("tenantId", tenantId)
                        .append("softDeleted", new Document("$ne", true))
                        .append("status", new Document("$ne", "DRAFT"))
                        .append("createdAt", new Document("$gte", from))),
                new Document("$group", new Document("_id",
                        new Document("$dateToString",
                                new Document("format", "%Y-%m").append("date", "$createdAt")))
                        .append("count", new Document("$sum", 1))));

        Map<String, Long> byMonth = new LinkedHashMap<>();
        for (Document row : aggregate(INVOICES, pipeline)) {
            byMonth.put(String.valueOf(row.get("_id")), asLong(row.get("count")));
        }

        // Fill the full window so the chart always shows the same 12 buckets.
        List<MonthPoint> points = new ArrayList<>();
        YearMonth cursor = YearMonth.now(WARSAW).minusMonths(months - 1L);
        for (int i = 0; i < months; i++) {
            String key = cursor.toString();                 // YearMonth.toString() is "YYYY-MM"
            points.add(new MonthPoint(key, byMonth.getOrDefault(key, 0L)));
            cursor = cursor.plusMonths(1);
        }
        return points;
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    private long countStatus(String tenantId, String status) {
        return count(INVOICES, tenant(tenantId)
                .and("softDeleted").ne(true)
                .and("status").is(status));
    }

    /**
     * Total value issued in the current calendar year, grouped by currency.
     * Drafts and soft-deleted rows are excluded. Amounts are summed inside
     * MongoDB, so no invoice document ever leaves the database.
     */
    private void addYearTotals(String tenantId, List<Metric> metrics) {
        Date yearStart = Date.from(LocalDate.now(WARSAW)
                .withDayOfYear(1).atStartOfDay(WARSAW).toInstant());

        List<Document> pipeline = List.of(
                new Document("$match", new Document("tenantId", tenantId)
                        .append("softDeleted", new Document("$ne", true))
                        .append("status", new Document("$ne", "DRAFT"))
                        .append("createdAt", new Document("$gte", yearStart))),
                new Document("$group", new Document("_id", "$currency")
                        .append("gross", new Document("$sum", "$totalGross"))));

        for (Document row : aggregate(INVOICES, pipeline)) {
            String currency = row.get("_id") == null ? "PLN" : String.valueOf(row.get("_id"));
            double gross = asDouble(row.get("gross"));
            metrics.add(new Metric("ksef.totals.grossThisYear." + currency,
                    String.format(java.util.Locale.ROOT, "%.2f", gross),
                    "MONEY", "NEUTRAL", null));
        }
    }

    /**
     * Certificate health. A KSeF certificate is what proves the company's
     * identity to the government system; if it lapses, filing stops completely,
     * so an expiring certificate is treated as a compliance obligation and not
     * just an IT task.
     *
     * Only certificate metadata is read (validity dates, purpose, status). The
     * certificate file and its password never leave their encrypted storage and
     * are not touched here.
     *
     * TWO THINGS ABOUT THE STORED DATA THAT THIS METHOD HAS TO WORK AROUND:
     *
     *   1. validTo is a calendar DAY, so KSeFFlow's Java LocalDate lands in MongoDB
     *      as the text "2027-04-30" rather than a date value. Comparing text
     *      against a date matches nothing, which would make an expired certificate
     *      report as healthy. The dayBefore / dayBetween helpers therefore match
     *      either storage form — see ModuleMetricsSupport.
     *
     *   2. The "purpose" field (AUTHENTICATION vs OFFLINE) is only written for
     *      certificates obtained through KSeF enrollment. Certificates uploaded by
     *      hand have no purpose at all. Treating a missing purpose as "not an
     *      authentication certificate" would raise a false alarm on every
     *      manually uploaded certificate, so a missing purpose is accepted here.
     */
    private void addCertificateMetrics(String tenantId,
                                       List<Metric> metrics,
                                       List<AttentionItem> attention) {

        LocalDate today = LocalDate.now(WARSAW);
        LocalDate warningEdge = today.plusDays(EXPIRY_WARNING_DAYS);

        // In use: switched on and cryptographically verified.
        Criteria inUse = tenant(tenantId)
                .and("active").is(true)
                .and("verificationStatus").is("VERIFIED");

        long active = count(CERTIFICATES, inUse);

        // Valid today, but runs out inside the 30-day warning window.
        long expiringSoon = count(CERTIFICATES, new Criteria().andOperator(
                tenant(tenantId).and("active").is(true).and("verificationStatus").is("VERIFIED"),
                dayBetween("validTo", today, warningEdge)));

        // Still marked active even though its validity date has passed.
        long expired = count(CERTIFICATES, new Criteria().andOperator(
                tenant(tenantId).and("active").is(true),
                dayBefore("validTo", today)));

        // Can the company authenticate to KSeF at all today? A missing purpose is
        // accepted — see point 2 in the method comment.
        long authUsable = count(CERTIFICATES, new Criteria().andOperator(
                tenant(tenantId).and("active").is(true).and("verificationStatus").is("VERIFIED"),
                new Criteria().orOperator(
                        Criteria.where("purpose").is("AUTHENTICATION"),
                        Criteria.where("purpose").is(null)),
                dayOnOrAfter("validTo", today)));

        metrics.add(Metric.count("ksef.certificates.active", active));
        metrics.add(Metric.count("ksef.certificates.expiringSoon", expiringSoon,
                expiringSoon > 0 ? "WARN" : "GOOD", LAW_KSEF_MANDATE));
        metrics.add(Metric.count("ksef.certificates.expired", expired,
                expired > 0 ? "RISK" : "GOOD", LAW_KSEF_MANDATE));

        // Soonest expiry among the certificates still in use — the date the admin
        // should diary. One tiny sorted projection; sorting ISO text gives the same
        // order as sorting dates.
        Document nearest = aggregateOne(CERTIFICATES, List.of(
                new Document("$match", new Document("tenantId", tenantId)
                        .append("active", true)
                        .append("verificationStatus", "VERIFIED")
                        .append("$or", List.of(
                                new Document("validTo", new Document("$gte", today.toString())),
                                new Document("validTo", new Document("$gte", startOfDay(today)))))),
                new Document("$sort", new Document("validTo", 1)),
                new Document("$limit", 1),
                new Document("$project", new Document("validTo", 1))));

        String nearestExpiry = asIsoDay(nearest.get("validTo"));
        if (nearestExpiry != null) {
            metrics.add(new Metric("ksef.certificates.nearestExpiry", nearestExpiry,
                    "DATE", "NEUTRAL", LAW_KSEF_MANDATE));
        }

        if (authUsable == 0) {
            // No usable authentication certificate means nothing can be filed.
            metrics.add(new Metric("ksef.certificates.authenticationReady", "0",
                    "COUNT", "RISK", LAW_KSEF_MANDATE));
            attention.add(new AttentionItem("KSEFFLOW", "KSEF_AUTH_CERTIFICATE_MISSING",
                    1, "RISK", LAW_KSEF_MANDATE, ROUTE));
        } else {
            metrics.add(new Metric("ksef.certificates.authenticationReady", "1",
                    "COUNT", "GOOD", LAW_KSEF_MANDATE));
        }

        if (expired > 0) {
            attention.add(new AttentionItem("KSEFFLOW", "KSEF_CERTIFICATE_EXPIRED",
                    (int) expired, "RISK", LAW_KSEF_MANDATE, ROUTE));
        }
        if (expiringSoon > 0) {
            attention.add(new AttentionItem("KSEFFLOW", "KSEF_CERTIFICATE_EXPIRING",
                    (int) expiringSoon, "WARN", LAW_KSEF_MANDATE, ROUTE));
        }
    }
}
