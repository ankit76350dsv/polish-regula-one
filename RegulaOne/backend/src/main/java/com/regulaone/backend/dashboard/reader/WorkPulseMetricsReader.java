package com.regulaone.backend.dashboard.reader;

import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.AttentionItem;
import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.Metric;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Reads the WorkPulse (working-time) numbers for one company.
 *
 * WHAT WorkPulse DOES: it records when employees clock in and out, their breaks,
 * their overtime and their absences. Those records are the evidence a Polish
 * labour inspector (PIP) would ask for.
 *
 * WHAT THIS READER WATCHES, AND WHY IT MATTERS LEGALLY: the Polish Labour Code
 * (Kodeks pracy) sets hard limits that WorkPulse already measures per shift. This
 * reader simply counts how many breaches are on the books right now:
 *   * missing or too-short breaks (art. 134),
 *   * less than 11 hours of daily rest (art. 132 §1),
 *   * less than 35 hours of weekly rest (art. 133 §1),
 *   * average working week above 48 hours (art. 131 §1),
 *   * more than 150 overtime hours in a year (art. 151 §3),
 *   * overtime or night work by a protected employee without consent
 *     (art. 178 §1–§2, art. 203),
 *   * clock-ins whose location looked wrong, which only exists at all when the
 *     company has properly announced monitoring (art. 22(2)).
 *
 * PRIVACY NOTE — WHAT IS DELIBERATELY LEFT OUT:
 *   Absences are counted as ONE number ("waiting for a decision"). The dashboard
 *   never breaks them down by type, because "sick leave" is health data and
 *   health data is special-category data under GDPR Art. 9. It must not appear on
 *   a general management overview. Likewise no employee names, no GPS
 *   coordinates, and no pregnancy / young-worker flags are read.
 */
@Repository
public class WorkPulseMetricsReader extends ModuleMetricsSupport {

    private static final String TIME_ENTRIES = "workplus_timeentries";
    private static final String ABSENCES = "workplus_absences";
    private static final String SETTLEMENTS = "workplus_settlement_summaries";
    private static final String MONITORING_ACKS = "workplus_monitoring_acks";

    private static final String ROUTE = "/modules/workpulse";

    // How far back the rolling compliance window looks.
    private static final int WINDOW_DAYS = 30;

    private static final String LAW_BREAK = "Kodeks pracy art. 134 (przerwa)";
    private static final String LAW_DAILY_REST = "Kodeks pracy art. 132 §1 (11 h odpoczynku)";
    private static final String LAW_WEEKLY_REST = "Kodeks pracy art. 133 §1 (35 h odpoczynku)";
    private static final String LAW_WEEKLY_CAP = "Kodeks pracy art. 131 §1 (48 h średnio)";
    private static final String LAW_OVERTIME_LIMIT = "Kodeks pracy art. 151 §3 (150 h/rok)";
    private static final String LAW_OVERTIME = "Kodeks pracy art. 151 (godziny nadliczbowe)";
    private static final String LAW_NIGHT = "Kodeks pracy art. 151(7)–151(8) (praca w nocy)";
    private static final String LAW_SUNDAY = "Kodeks pracy art. 151(9)–151(10) (niedziele i święta)";
    private static final String LAW_PROTECTED = "Kodeks pracy art. 178, art. 203 (pracownicy chronieni)";
    private static final String LAW_MONITORING = "Kodeks pracy art. 22(2) (monitoring)";
    private static final String LAW_RECORDS = "Kodeks pracy art. 149 (ewidencja czasu pracy)";

    public WorkPulseMetricsReader(MongoTemplate mongo) {
        super(mongo);
    }

    public ModuleSnapshot read(String tenantId) {
        List<Metric> metrics = new ArrayList<>();
        List<AttentionItem> attention = new ArrayList<>();

        // NOTE ON EVERY FILTER BELOW: soft-deleted rows are kept for the
        // record-keeping rule but are not live work, so "deletedAt is null" is
        // always part of the query.

        // ── Who is working right now ───────────────────────────────────────────
        long open = count(TIME_ENTRIES, tenant(tenantId).and("deletedAt").is(null)
                .and("workDate").gte(startOfToday()).and("status").is("OPEN"));
        long onBreak = count(TIME_ENTRIES, tenant(tenantId).and("deletedAt").is(null)
                .and("workDate").gte(startOfToday()).and("status").is("ON_BREAK"));
        long completedToday = count(TIME_ENTRIES, tenant(tenantId).and("deletedAt").is(null)
                .and("workDate").gte(startOfToday()).and("status").is("COMPLETED"));

        metrics.add(Metric.count("workpulse.today.clockedIn", open + onBreak));
        metrics.add(Metric.count("workpulse.today.onBreak", onBreak));
        metrics.add(Metric.count("workpulse.today.completed", completedToday));

        // ── Shifts that were never closed properly ─────────────────────────────
        // A shift with no clock-out is a gap in the statutory working-time
        // record, so it has to be corrected by HR.
        long missingClockOut = count(TIME_ENTRIES, tenant(tenantId).and("deletedAt").is(null)
                .and("workDate").gte(daysAgo(WINDOW_DAYS))
                .and("status").in("MISSING_CLOCK_OUT", "AUTO_CLOSED"));
        metrics.add(Metric.count("workpulse.window.missingClockOut", missingClockOut,
                missingClockOut > 0 ? "WARN" : "GOOD", LAW_RECORDS));

        // ── Decisions waiting on a manager ─────────────────────────────────────
        long overtimePending = count(TIME_ENTRIES, tenant(tenantId).and("deletedAt").is(null)
                .and("approvalStatus").is("PENDING"));
        // Absences are counted as one total on purpose — see the privacy note above.
        long absencesPending = count(ABSENCES, tenant(tenantId).and("deletedAt").is(null)
                .and("status").is("PENDING"));

        metrics.add(Metric.count("workpulse.approvals.overtimePending", overtimePending,
                overtimePending > 0 ? "WARN" : "GOOD", LAW_OVERTIME));
        metrics.add(Metric.count("workpulse.approvals.absencesPending", absencesPending,
                absencesPending > 0 ? "WARN" : "NEUTRAL", null));

        // ── Rolling 30-day working-time compliance ─────────────────────────────
        addWindowTotals(tenantId, metrics, attention);

        // ── Settlement-period limits (the yearly and averaged caps) ─────────────
        addSettlementMetrics(tenantId, metrics, attention);

        // ── Monitoring transparency ────────────────────────────────────────────
        // Location monitoring is only lawful once employees have been informed.
        // The count of recorded acknowledgements is the evidence of that.
        long acks = count(MONITORING_ACKS, tenant(tenantId));
        metrics.add(Metric.count("workpulse.monitoring.acknowledgements", acks,
                "NEUTRAL", LAW_MONITORING));

        // ── Attention list ─────────────────────────────────────────────────────
        if (overtimePending > 0) {
            attention.add(new AttentionItem("WORKPULSE", "WORKPULSE_OVERTIME_APPROVAL_PENDING",
                    (int) overtimePending, "WARN", LAW_OVERTIME, ROUTE));
        }
        if (absencesPending > 0) {
            attention.add(new AttentionItem("WORKPULSE", "WORKPULSE_ABSENCE_APPROVAL_PENDING",
                    (int) absencesPending, "WARN", null, ROUTE));
        }
        if (missingClockOut > 0) {
            attention.add(new AttentionItem("WORKPULSE", "WORKPULSE_MISSING_CLOCK_OUT",
                    (int) missingClockOut, "WARN", LAW_RECORDS, ROUTE));
        }

        return new ModuleSnapshot(metrics, attention);
    }

    /**
     * Adds up the last 30 days of shifts in ONE database round trip: total time
     * worked, total overtime, and how many shifts broke each Labour Code rule.
     */
    private void addWindowTotals(String tenantId,
                                 List<Metric> metrics,
                                 List<AttentionItem> attention) {

        List<Document> pipeline = List.of(
                new Document("$match", new Document("tenantId", tenantId)
                        .append("deletedAt", null)
                        .append("workDate", new Document("$gte", daysAgo(WINDOW_DAYS)))),
                new Document("$group", new Document("_id", null)
                        .append("workedMinutes", new Document("$sum", "$netWorkedMinutes"))
                        .append("overtimeMinutes", new Document("$sum", "$overtimeMinutes"))
                        .append("missingBreak", sumWhenEquals("$breakComplianceStatus", "MISSING_BREAK"))
                        .append("shortBreak", sumWhenEquals("$breakComplianceStatus", "SHORT_BREAK"))
                        .append("dailyRest", sumWhenTrue("$dailyRest.violation"))
                        .append("weeklyRest", sumWhenTrue("$weeklyRest.violation"))
                        .append("nightShifts", sumWhenTrue("$isNightWork"))
                        .append("sundayShifts", sumWhenTrue("$isSundayWork"))
                        .append("holidayShifts", sumWhenTrue("$isHolidayWork"))
                        .append("protectedFlagged", sumWhenTrue("$protectedWorkFlagged"))
                        .append("locationFlagged", sumWhenTrue("$locationFlagged"))));

        Document w = aggregateOne(TIME_ENTRIES, pipeline);

        long missingBreak = asLong(w.get("missingBreak"));
        long shortBreak = asLong(w.get("shortBreak"));
        long dailyRest = asLong(w.get("dailyRest"));
        long weeklyRest = asLong(w.get("weeklyRest"));
        long protectedFlagged = asLong(w.get("protectedFlagged"));
        long locationFlagged = asLong(w.get("locationFlagged"));

        metrics.add(new Metric("workpulse.window.workedHours",
                hours(asLong(w.get("workedMinutes"))), "HOURS", "NEUTRAL", LAW_RECORDS));
        metrics.add(new Metric("workpulse.window.overtimeHours",
                hours(asLong(w.get("overtimeMinutes"))), "HOURS", "NEUTRAL", LAW_OVERTIME));

        metrics.add(Metric.count("workpulse.window.missingBreak", missingBreak,
                missingBreak > 0 ? "RISK" : "GOOD", LAW_BREAK));
        metrics.add(Metric.count("workpulse.window.shortBreak", shortBreak,
                shortBreak > 0 ? "WARN" : "GOOD", LAW_BREAK));
        metrics.add(Metric.count("workpulse.window.dailyRestViolations", dailyRest,
                dailyRest > 0 ? "RISK" : "GOOD", LAW_DAILY_REST));
        metrics.add(Metric.count("workpulse.window.weeklyRestViolations", weeklyRest,
                weeklyRest > 0 ? "RISK" : "GOOD", LAW_WEEKLY_REST));
        metrics.add(Metric.count("workpulse.window.nightShifts",
                asLong(w.get("nightShifts")), "NEUTRAL", LAW_NIGHT));
        metrics.add(Metric.count("workpulse.window.sundayHolidayShifts",
                asLong(w.get("sundayShifts")) + asLong(w.get("holidayShifts")),
                "NEUTRAL", LAW_SUNDAY));
        metrics.add(Metric.count("workpulse.window.protectedWorkFlagged", protectedFlagged,
                protectedFlagged > 0 ? "RISK" : "GOOD", LAW_PROTECTED));
        metrics.add(Metric.count("workpulse.window.locationFlagged", locationFlagged,
                locationFlagged > 0 ? "WARN" : "GOOD", LAW_MONITORING));

        if (missingBreak > 0) {
            attention.add(new AttentionItem("WORKPULSE", "WORKPULSE_MISSING_BREAK",
                    (int) missingBreak, "RISK", LAW_BREAK, ROUTE));
        }
        if (dailyRest > 0) {
            attention.add(new AttentionItem("WORKPULSE", "WORKPULSE_DAILY_REST_VIOLATION",
                    (int) dailyRest, "RISK", LAW_DAILY_REST, ROUTE));
        }
        if (weeklyRest > 0) {
            attention.add(new AttentionItem("WORKPULSE", "WORKPULSE_WEEKLY_REST_VIOLATION",
                    (int) weeklyRest, "RISK", LAW_WEEKLY_REST, ROUTE));
        }
        if (protectedFlagged > 0) {
            attention.add(new AttentionItem("WORKPULSE", "WORKPULSE_PROTECTED_WORK_FLAGGED",
                    (int) protectedFlagged, "RISK", LAW_PROTECTED, ROUTE));
        }
        if (locationFlagged > 0) {
            attention.add(new AttentionItem("WORKPULSE", "WORKPULSE_LOCATION_FLAGGED",
                    (int) locationFlagged, "WARN", LAW_MONITORING, ROUTE));
        }
    }

    /**
     * The two caps that are measured over a whole settlement period rather than a
     * single shift: the 48-hour average working week and the 150-hour yearly
     * overtime limit. WorkPulse already flags both on its settlement summaries, so
     * the dashboard only counts how many employees are affected this year.
     */
    private void addSettlementMetrics(String tenantId,
                                      List<Metric> metrics,
                                      List<AttentionItem> attention) {
        int year = LocalDate.now(WARSAW).getYear();

        long overWeeklyCap = count(SETTLEMENTS, tenant(tenantId)
                .and("year").is(year).and("exceedsWeeklyAverageCap").is(true));
        long overAnnual = count(SETTLEMENTS, tenant(tenantId)
                .and("year").is(year).and("exceedsAnnualOvertimeLimit").is(true));
        long nearAnnual = count(SETTLEMENTS, tenant(tenantId)
                .and("year").is(year).and("approachingAnnualOvertimeLimit").is(true));

        metrics.add(Metric.count("workpulse.settlement.overWeeklyAverageCap", overWeeklyCap,
                overWeeklyCap > 0 ? "RISK" : "GOOD", LAW_WEEKLY_CAP));
        metrics.add(Metric.count("workpulse.settlement.overAnnualOvertimeLimit", overAnnual,
                overAnnual > 0 ? "RISK" : "GOOD", LAW_OVERTIME_LIMIT));
        metrics.add(Metric.count("workpulse.settlement.approachingAnnualOvertimeLimit", nearAnnual,
                nearAnnual > 0 ? "WARN" : "GOOD", LAW_OVERTIME_LIMIT));

        if (overWeeklyCap > 0) {
            attention.add(new AttentionItem("WORKPULSE", "WORKPULSE_WEEKLY_AVERAGE_CAP_EXCEEDED",
                    (int) overWeeklyCap, "RISK", LAW_WEEKLY_CAP, ROUTE));
        }
        if (overAnnual > 0) {
            attention.add(new AttentionItem("WORKPULSE", "WORKPULSE_ANNUAL_OVERTIME_LIMIT_EXCEEDED",
                    (int) overAnnual, "RISK", LAW_OVERTIME_LIMIT, ROUTE));
        }
        if (nearAnnual > 0) {
            attention.add(new AttentionItem("WORKPULSE", "WORKPULSE_ANNUAL_OVERTIME_LIMIT_NEAR",
                    (int) nearAnnual, "WARN", LAW_OVERTIME_LIMIT, ROUTE));
        }
    }

    // ── Tiny aggregation building blocks ────────────────────────────────────────

    /** "$sum: 1 when this field equals that value, else 0" — a conditional count. */
    private static Document sumWhenEquals(String field, String value) {
        return new Document("$sum", new Document("$cond",
                List.of(new Document("$eq", List.of(field, value)), 1, 0)));
    }

    /** "$sum: 1 when this boolean field is true, else 0". */
    private static Document sumWhenTrue(String field) {
        return new Document("$sum", new Document("$cond",
                List.of(new Document("$eq", List.of(field, true)), 1, 0)));
    }
}
