package com.regulaone.backend.repository.modules;

import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.AttentionItem;
import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.Metric;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Reads the WasteSync (BDO environmental reporting) numbers for one company.
 *
 * WHAT WasteSync DOES: it records how much waste each of the customer's legal
 * entities produced each month, and generates the yearly report that has to be
 * filed in BDO, the Polish national waste database.
 *
 * THE TWO DEADLINES THAT MATTER:
 *   1. Monthly records. Waste must be recorded as it arises (ustawa o odpadach
 *      art. 66–67). A month with no data is a gap in the statutory register, so
 *      the dashboard counts how many finished months are still empty.
 *   2. The yearly report. The report for a calendar year must be filed by
 *      15 March of the FOLLOWING year (ustawa o odpadach art. 76 ust. 1). That is
 *      why this reader looks at LAST year's report, not this year's — this year's
 *      is not due yet. After 15 March, an unfiled report is reported as a RISK.
 *
 * A company with no BDO registration number cannot file anything at all, so that
 * is flagged too.
 *
 * Only counts, weights and filing status are read — never waste-record details.
 */
@Repository
public class WasteSyncMetricsReader extends ModuleMetricsSupport {

    private static final String COMPANIES = "wastesync_companies";
    private static final String ENTRIES = "wastesync_waste_entries";
    private static final String REPORTS = "wastesync_annual_reports";

    private static final String ROUTE = "/modules/wastesync";

    private static final String LAW_REGISTER = "Ustawa o odpadach art. 66–67 (ewidencja / BDO)";
    private static final String LAW_ANNUAL_REPORT = "Ustawa o odpadach art. 76 ust. 1 (do 15 marca)";

    // The statutory filing date for the previous year's report.
    private static final int REPORT_DEADLINE_MONTH = 3;
    private static final int REPORT_DEADLINE_DAY = 15;

    public WasteSyncMetricsReader(MongoTemplate mongo) {
        super(mongo);
    }

    public ModuleSnapshot read(String tenantId) {
        List<Metric> metrics = new ArrayList<>();
        List<AttentionItem> attention = new ArrayList<>();

        LocalDate today = LocalDate.now(WARSAW);
        int thisYear = today.getYear();
        int reportingYear = thisYear - 1;   // the year whose report is (or was) due

        // ── The customer's legal entities ──────────────────────────────────────
        // Soft-deleted companies are kept for the 10-year retention rule but are
        // not counted as live reporting obligations. The ids are fetched once here
        // and reused below, so the same list drives every figure on this card.
        List<Object> companyIds = activeCompanyIds(tenantId);
        long activeCompanies = companyIds.size();

        // Without a BDO number nothing can be submitted to the government portal.
        long missingBdo = count(COMPANIES, tenant(tenantId)
                .and("deletedAt").is(null)
                .and("isActive").ne(false)
                .orOperator(
                        org.springframework.data.mongodb.core.query.Criteria
                                .where("bdoRegistrationNumber").is(null),
                        org.springframework.data.mongodb.core.query.Criteria
                                .where("bdoRegistrationNumber").is("")));

        metrics.add(Metric.count("wastesync.companies.active", activeCompanies));
        metrics.add(Metric.count("wastesync.companies.missingBdoNumber", missingBdo,
                missingBdo > 0 ? "RISK" : "GOOD", LAW_REGISTER));

        // ── This year's monthly records ────────────────────────────────────────
        addCurrentYearMetrics(tenantId, thisYear, today, companyIds, metrics, attention);

        // ── Last year's statutory report ───────────────────────────────────────
        addAnnualReportMetrics(tenantId, reportingYear, today, activeCompanies, metrics, attention);

        if (missingBdo > 0) {
            attention.add(new AttentionItem("WASTESYNC", "WASTESYNC_BDO_NUMBER_MISSING",
                    (int) missingBdo, "RISK", LAW_REGISTER, ROUTE));
        }

        return new ModuleSnapshot(metrics, attention);
    }

    /**
     * How much waste has been recorded this year, and how many finished months
     * are still empty.
     *
     * Only FINISHED months are counted as missing: the month we are currently in
     * is not late yet, so counting it would raise a false alarm.
     */
    private void addCurrentYearMetrics(String tenantId,
                                       int year,
                                       LocalDate today,
                                       List<Object> companyIds,
                                       List<Metric> metrics,
                                       List<AttentionItem> attention) {

        // Only the latest version of each monthly record counts — WasteSync keeps
        // earlier versions for the audit trail, and adding them would double-count.
        Document totals = aggregateOne(ENTRIES, List.of(
                new Document("$match", new Document("tenantId", tenantId)
                        .append("year", year)
                        .append("isLatest", true)),
                new Document("$group", new Document("_id", null)
                        .append("entries", new Document("$sum", 1))
                        .append("totalKg", new Document("$sum", "$totalWeightKg")))));

        metrics.add(Metric.count("wastesync.entries.thisYear", asLong(totals.get("entries"))));
        metrics.add(new Metric("wastesync.totals.thisYearKg",
                kilograms(asDouble(totals.get("totalKg"))), "KG", "NEUTRAL", LAW_REGISTER));

        // Which (company, month) pairs already have data? One small projection.
        Set<String> filled = new HashSet<>();
        for (Document row : aggregate(ENTRIES, List.of(
                new Document("$match", new Document("tenantId", tenantId)
                        .append("year", year)
                        .append("isLatest", true)),
                new Document("$group", new Document("_id",
                        new Document("companyId", "$companyId").append("month", "$month")))))) {
            Document key = (Document) row.get("_id");
            filled.add(key.get("companyId") + "-" + key.get("month"));
        }

        // Every company owes a record for every month that has already ended.
        int finishedMonths = today.getMonthValue() - 1;
        long missingMonths = 0;
        for (Object companyId : companyIds) {
            for (int month = 1; month <= finishedMonths; month++) {
                if (!filled.contains(companyId + "-" + month)) missingMonths++;
            }
        }

        metrics.add(Metric.count("wastesync.entries.missingMonths", missingMonths,
                missingMonths > 0 ? "WARN" : "GOOD", LAW_REGISTER));

        if (missingMonths > 0) {
            attention.add(new AttentionItem("WASTESYNC", "WASTESYNC_MONTHLY_DATA_MISSING",
                    (int) missingMonths, "WARN", LAW_REGISTER, ROUTE));
        }
    }

    /**
     * The yearly BDO report for {@code reportingYear}, which was due by 15 March of
     * the year after it.
     *
     * "SUBMITTED" means the customer confirmed the XML was uploaded to the BDO
     * portal. A report that is only "GENERATED" has been produced but not filed —
     * which still leaves the legal obligation open.
     */
    private void addAnnualReportMetrics(String tenantId,
                                        int reportingYear,
                                        LocalDate today,
                                        long activeCompanies,
                                        List<Metric> metrics,
                                        List<AttentionItem> attention) {

        LocalDate deadline = LocalDate.of(reportingYear + 1, REPORT_DEADLINE_MONTH, REPORT_DEADLINE_DAY);
        boolean pastDeadline = today.isAfter(deadline);

        // How many of the customer's companies have actually FILED for that year.
        Set<Object> submitted = new HashSet<>();
        Set<Object> generated = new HashSet<>();
        long thresholdBreaches = 0;

        for (Document row : aggregate(REPORTS, List.of(
                new Document("$match", new Document("tenantId", tenantId)
                        .append("year", reportingYear)),
                new Document("$project", new Document("companyId", 1)
                        .append("status", 1)
                        .append("breaches", "$thresholdValidation.breaches"))))) {

            Object companyId = row.get("companyId");
            if ("SUBMITTED".equals(row.getString("status"))) {
                submitted.add(companyId);
            } else {
                generated.add(companyId);
            }
            if (row.get("breaches") instanceof List<?> breaches) {
                thresholdBreaches += breaches.size();
            }
        }

        long notSubmitted = Math.max(0, activeCompanies - submitted.size());

        metrics.add(new Metric("wastesync.report.reportingYear",
                Integer.toString(reportingYear), "TEXT", "NEUTRAL", LAW_ANNUAL_REPORT));
        metrics.add(new Metric("wastesync.report.deadline",
                deadline.toString(), "DATE",
                pastDeadline && notSubmitted > 0 ? "RISK" : "NEUTRAL", LAW_ANNUAL_REPORT));
        metrics.add(Metric.count("wastesync.report.submitted", submitted.size(),
                "GOOD", LAW_ANNUAL_REPORT));
        metrics.add(Metric.count("wastesync.report.generatedNotSubmitted", generated.size(),
                generated.isEmpty() ? "GOOD" : "WARN", LAW_ANNUAL_REPORT));
        metrics.add(Metric.count("wastesync.report.notSubmitted", notSubmitted,
                notSubmitted == 0 ? "GOOD" : pastDeadline ? "RISK" : "WARN", LAW_ANNUAL_REPORT));
        metrics.add(Metric.count("wastesync.report.thresholdBreaches", thresholdBreaches,
                thresholdBreaches > 0 ? "WARN" : "GOOD", LAW_REGISTER));

        if (notSubmitted > 0) {
            // Before 15 March this is a reminder; after it, the deadline has been
            // missed and it becomes a real legal exposure.
            attention.add(new AttentionItem("WASTESYNC",
                    pastDeadline ? "WASTESYNC_ANNUAL_REPORT_OVERDUE" : "WASTESYNC_ANNUAL_REPORT_DUE",
                    (int) notSubmitted, pastDeadline ? "RISK" : "WARN",
                    LAW_ANNUAL_REPORT, ROUTE));
        }
        if (thresholdBreaches > 0) {
            attention.add(new AttentionItem("WASTESYNC", "WASTESYNC_THRESHOLD_BREACH",
                    (int) thresholdBreaches, "WARN", LAW_REGISTER, ROUTE));
        }
    }

    /** Ids of the customer's live companies — used to work out which months are empty. */
    private List<Object> activeCompanyIds(String tenantId) {
        List<Object> ids = new ArrayList<>();
        for (Document row : aggregate(COMPANIES, List.of(
                new Document("$match", new Document("tenantId", tenantId)
                        .append("deletedAt", null)
                        .append("isActive", new Document("$ne", false))),
                new Document("$project", new Document("_id", 1))))) {
            ids.add(row.get("_id"));
        }
        return ids;
    }
}
