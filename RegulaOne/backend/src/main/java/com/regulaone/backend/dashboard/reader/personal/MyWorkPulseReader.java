package com.regulaone.backend.dashboard.reader.personal;

import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.AttentionItem;
import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.Metric;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Reads ONE PERSON'S own working-time position out of WorkPulse.
 *
 * WHAT THE PERSON SEES HERE: their shift today, the hours and overtime they have
 * worked this month, the requests they are waiting on a decision for, and any of
 * their OWN shifts that broke a Labour Code rule. Nothing about anybody else.
 *
 * WHY AN EMPLOYEE IS SHOWN THEIR OWN BREACHES:
 *   The Labour Code limits below protect the employee, and the employer must keep
 *   the working-time record that proves them (Kodeks pracy art. 149). Letting the
 *   person see their own record is how a wrong entry gets found and corrected:
 *     * missing or too-short break (art. 134),
 *     * less than 11 hours of daily rest (art. 132 §1),
 *     * less than 35 hours of weekly rest (art. 133 §1),
 *     * more than 150 overtime hours in a year (art. 151 §3),
 *     * average working week above 48 hours (art. 131 §1).
 *
 * THE MONITORING NOTICE (art. 22² / 22³ Kodeks pracy):
 *   Location tracking is only lawful once the employee has been INFORMED. When the
 *   company has switched tracking on, this reader checks whether this person has
 *   acknowledged the CURRENT version of the notice and, if not, puts that on their
 *   to-do list. When tracking is off there is nothing to acknowledge, so the figure
 *   is left out entirely rather than shown as a scary zero.
 *
 * PRIVACY NOTE — WHAT IS DELIBERATELY LEFT OUT:
 *   Absences are counted, never listed by type: "sick leave" is health data
 *   (GDPR Art. 9) and a dashboard tile does not need it — even the person's own
 *   screen gets only "how many requests are waiting for a decision". No GPS
 *   coordinates are read, and the protected-group flags (pregnancy, young worker)
 *   are never read at all.
 */
@Repository
public class MyWorkPulseReader extends PersonalMetricsSupport {

    private static final String TIME_ENTRIES = "workplus_timeentries";
    private static final String ABSENCES = "workplus_absences";
    private static final String SETTLEMENTS = "workplus_settlement_summaries";
    private static final String MONITORING_ACKS = "workplus_monitoring_acks";
    private static final String POLICIES = "workplus_policies";

    /** WorkPulse names the owner of a record "userId" and stores it as an ObjectId. */
    private static final String OWNER = "userId";

    private static final String ROUTE = "/modules/workpulse";

    /** How far back the rolling personal compliance window looks. */
    private static final int WINDOW_DAYS = 30;

    private static final String LAW_BREAK = "Kodeks pracy art. 134 (przerwa)";
    private static final String LAW_DAILY_REST = "Kodeks pracy art. 132 §1 (11 h odpoczynku)";
    private static final String LAW_WEEKLY_REST = "Kodeks pracy art. 133 §1 (35 h odpoczynku)";
    private static final String LAW_WEEKLY_CAP = "Kodeks pracy art. 131 §1 (48 h średnio)";
    private static final String LAW_OVERTIME_LIMIT = "Kodeks pracy art. 151 §3 (150 h/rok)";
    private static final String LAW_OVERTIME = "Kodeks pracy art. 151 (godziny nadliczbowe)";
    private static final String LAW_NIGHT = "Kodeks pracy art. 151(7)–151(8) (praca w nocy)";
    private static final String LAW_SUNDAY = "Kodeks pracy art. 151(9)–151(10) (niedziele i święta)";
    private static final String LAW_RECORDS = "Kodeks pracy art. 149 (ewidencja czasu pracy)";
    private static final String LAW_MONITORING = "Kodeks pracy art. 22(2)–22(3) (monitoring)";

    public MyWorkPulseReader(MongoTemplate mongo) {
        super(mongo);
    }

    /**
     * @param tenantId the caller's company, resolved from their session
     * @param userId   the caller's own RegulaOne user id — every query below is
     *                 limited to it, so no colleague's shift can ever be counted
     */
    public PersonalSnapshot read(String tenantId, String userId) {
        List<Metric> metrics = new ArrayList<>();
        List<AttentionItem> attention = new ArrayList<>();

        // "My live records": my company, me, and not soft-deleted. Soft-deleted rows
        // are kept for the 10-year retention rule but are not live work.
        Criteria mine = mineByObjectId(tenantId, OWNER, userId).and("deletedAt").is(null);

        addTodayMetrics(mine, metrics, attention);
        addMonthTotals(tenantId, userId, metrics);
        addWindowCompliance(tenantId, userId, metrics, attention);
        addPendingDecisions(mine, tenantId, userId, metrics, attention);
        addYearlyOvertime(tenantId, userId, metrics, attention);
        addMonitoringNotice(tenantId, userId, metrics, attention);

        return PersonalSnapshot.of(metrics, attention);
    }

    // ── Today ───────────────────────────────────────────────────────────────────

    /**
     * What is happening with my shift today.
     *
     * The newest entry for today decides the status, because a day can hold more
     * than one shift and the latest one is the one the person is living in.
     * NOT_STARTED is reported when there is no entry at all — an honest "you have
     * not clocked in yet" rather than a blank tile.
     */
    private void addTodayMetrics(Criteria mine, List<Metric> metrics, List<AttentionItem> attention) {
        Document today = mongo.findOne(
                Query.query(new Criteria().andOperator(mine,
                                Criteria.where("workDate").gte(startOfToday())))
                        .with(Sort.by(Sort.Direction.DESC, "clockIn"))
                        .limit(1),
                Document.class, TIME_ENTRIES);

        String status = today == null ? "NOT_STARTED" : String.valueOf(today.get("status"));
        long workedToday = today == null ? 0 : asLong(today.get("netWorkedMinutes"));

        metrics.add(new Metric("my.workpulse.today.status", status, "TEXT",
                switch (status) {
                    case "MISSING_CLOCK_OUT", "AUTO_CLOSED" -> "WARN";
                    case "OPEN", "ON_BREAK" -> "GOOD";
                    default -> "NEUTRAL";
                }, LAW_RECORDS));
        metrics.add(new Metric("my.workpulse.today.workedHours", hours(workedToday),
                "HOURS", "NEUTRAL", LAW_RECORDS));

        // A shift the system had to close, or that was never closed, leaves a gap in
        // the statutory record — the person should ask HR to correct it.
        if ("MISSING_CLOCK_OUT".equals(status) || "AUTO_CLOSED".equals(status)) {
            attention.add(new AttentionItem("WORKPULSE", "MY_WORKPULSE_TODAY_NOT_CLOSED",
                    1, "WARN", LAW_RECORDS, ROUTE));
        }
    }

    // ── This month ──────────────────────────────────────────────────────────────

    /**
     * My hours this calendar month, added up inside MongoDB in one round trip.
     * Night and Sunday/holiday shifts are included because they carry extra pay
     * (art. 151(8) and art. 151(11)), so the person has a reason to check them.
     */
    private void addMonthTotals(String tenantId, String userId, List<Metric> metrics) {
        Document totals = aggregateOne(TIME_ENTRIES, List.of(
                new Document("$match", ownerMatch(tenantId, userId)
                        .append("deletedAt", null)
                        .append("workDate", new Document("$gte", startOfThisMonth()))),
                new Document("$group", new Document("_id", null)
                        .append("worked", new Document("$sum", "$netWorkedMinutes"))
                        .append("overtime", new Document("$sum", "$overtimeMinutes"))
                        .append("shifts", new Document("$sum", 1))
                        .append("night", sumWhenTrue("$isNightWork"))
                        .append("sunday", sumWhenTrue("$isSundayWork"))
                        .append("holiday", sumWhenTrue("$isHolidayWork")))));

        metrics.add(new Metric("my.workpulse.month.workedHours",
                hours(asLong(totals.get("worked"))), "HOURS", "NEUTRAL", LAW_RECORDS));
        metrics.add(new Metric("my.workpulse.month.overtimeHours",
                hours(asLong(totals.get("overtime"))), "HOURS", "NEUTRAL", LAW_OVERTIME));
        metrics.add(Metric.count("my.workpulse.month.shifts", asLong(totals.get("shifts"))));
        metrics.add(Metric.count("my.workpulse.month.nightShifts",
                asLong(totals.get("night")), "NEUTRAL", LAW_NIGHT));
        metrics.add(Metric.count("my.workpulse.month.sundayHolidayShifts",
                asLong(totals.get("sunday")) + asLong(totals.get("holiday")),
                "NEUTRAL", LAW_SUNDAY));
    }

    // ── My last 30 days of Labour Code checks ───────────────────────────────────

    /**
     * How many of MY OWN shifts in the last 30 days broke a working-time rule.
     * WorkPulse already decided each of these per shift; this only counts them, so
     * the dashboard and the module can never disagree about what a breach is.
     */
    private void addWindowCompliance(String tenantId, String userId,
                                     List<Metric> metrics, List<AttentionItem> attention) {

        Document w = aggregateOne(TIME_ENTRIES, List.of(
                new Document("$match", ownerMatch(tenantId, userId)
                        .append("deletedAt", null)
                        .append("workDate", new Document("$gte", daysAgo(WINDOW_DAYS)))),
                new Document("$group", new Document("_id", null)
                        .append("missingBreak", sumWhenEquals("$breakComplianceStatus", "MISSING_BREAK"))
                        .append("shortBreak", sumWhenEquals("$breakComplianceStatus", "SHORT_BREAK"))
                        .append("dailyRest", sumWhenTrue("$dailyRest.violation"))
                        .append("weeklyRest", sumWhenTrue("$weeklyRest.violation"))
                        .append("missingClockOut", new Document("$sum", new Document("$cond",
                                List.of(new Document("$in", List.of("$status",
                                                List.of("MISSING_CLOCK_OUT", "AUTO_CLOSED"))),
                                        1, 0)))))));

        long missingBreak = asLong(w.get("missingBreak"));
        long shortBreak = asLong(w.get("shortBreak"));
        long dailyRest = asLong(w.get("dailyRest"));
        long weeklyRest = asLong(w.get("weeklyRest"));
        long missingClockOut = asLong(w.get("missingClockOut"));

        metrics.add(Metric.count("my.workpulse.window.missingBreak", missingBreak,
                missingBreak > 0 ? "RISK" : "GOOD", LAW_BREAK));
        metrics.add(Metric.count("my.workpulse.window.shortBreak", shortBreak,
                shortBreak > 0 ? "WARN" : "GOOD", LAW_BREAK));
        metrics.add(Metric.count("my.workpulse.window.dailyRestViolations", dailyRest,
                dailyRest > 0 ? "RISK" : "GOOD", LAW_DAILY_REST));
        metrics.add(Metric.count("my.workpulse.window.weeklyRestViolations", weeklyRest,
                weeklyRest > 0 ? "RISK" : "GOOD", LAW_WEEKLY_REST));
        metrics.add(Metric.count("my.workpulse.window.missingClockOut", missingClockOut,
                missingClockOut > 0 ? "WARN" : "GOOD", LAW_RECORDS));

        if (missingBreak > 0) {
            attention.add(new AttentionItem("WORKPULSE", "MY_WORKPULSE_MISSING_BREAK",
                    (int) missingBreak, "RISK", LAW_BREAK, ROUTE));
        }
        if (dailyRest > 0) {
            attention.add(new AttentionItem("WORKPULSE", "MY_WORKPULSE_DAILY_REST_VIOLATION",
                    (int) dailyRest, "RISK", LAW_DAILY_REST, ROUTE));
        }
        if (weeklyRest > 0) {
            attention.add(new AttentionItem("WORKPULSE", "MY_WORKPULSE_WEEKLY_REST_VIOLATION",
                    (int) weeklyRest, "RISK", LAW_WEEKLY_REST, ROUTE));
        }
        if (missingClockOut > 0) {
            attention.add(new AttentionItem("WORKPULSE", "MY_WORKPULSE_MISSING_CLOCK_OUT",
                    (int) missingClockOut, "WARN", LAW_RECORDS, ROUTE));
        }
    }

    // ── What I am waiting on ────────────────────────────────────────────────────

    /**
     * My own requests that still need a manager's decision, and the leave I already
     * have approved and coming up. Both are things the person is genuinely waiting
     * for, which is what belongs on a personal dashboard.
     */
    private void addPendingDecisions(Criteria mine, String tenantId, String userId,
                                     List<Metric> metrics, List<AttentionItem> attention) {

        long overtimePending = count(TIME_ENTRIES, new Criteria().andOperator(mine,
                Criteria.where("approvalStatus").is("PENDING")));

        Criteria myAbsences = mineByObjectId(tenantId, OWNER, userId).and("deletedAt").is(null);

        long absencesPending = count(ABSENCES,
                new Criteria().andOperator(myAbsences, Criteria.where("status").is("PENDING")));

        // Leave already granted that has not started yet — "what is coming up".
        long absencesUpcoming = count(ABSENCES, new Criteria().andOperator(myAbsences,
                Criteria.where("status").is("APPROVED"),
                Criteria.where("startDate").gte(startOfToday())));

        metrics.add(Metric.count("my.workpulse.approvals.overtimePending", overtimePending,
                overtimePending > 0 ? "WARN" : "GOOD", LAW_OVERTIME));
        metrics.add(Metric.count("my.workpulse.absences.pending", absencesPending,
                absencesPending > 0 ? "WARN" : "NEUTRAL", null));
        metrics.add(Metric.count("my.workpulse.absences.upcomingApproved", absencesUpcoming));

        if (overtimePending > 0) {
            attention.add(new AttentionItem("WORKPULSE", "MY_WORKPULSE_OVERTIME_AWAITING_DECISION",
                    (int) overtimePending, "WARN", LAW_OVERTIME, ROUTE));
        }
        if (absencesPending > 0) {
            attention.add(new AttentionItem("WORKPULSE", "MY_WORKPULSE_ABSENCE_AWAITING_DECISION",
                    (int) absencesPending, "WARN", null, ROUTE));
        }
    }

    // ── The yearly caps ─────────────────────────────────────────────────────────

    /**
     * My overtime this year against the 150-hour limit (art. 151 §3), and whether my
     * average working week has passed 48 hours (art. 131 §1).
     *
     * WorkPulse recalculates these on its settlement summaries, one row per
     * settlement period. The yearly overtime figure is the LARGEST value found for
     * this year rather than a sum, because each row already carries the running
     * year-to-date total — adding them would count the same hours several times.
     */
    private void addYearlyOvertime(String tenantId, String userId,
                                   List<Metric> metrics, List<AttentionItem> attention) {

        int year = LocalDate.now(WARSAW).getYear();

        Document summary = aggregateOne(SETTLEMENTS, List.of(
                new Document("$match", ownerMatch(tenantId, userId).append("year", year)),
                new Document("$group", new Document("_id", null)
                        .append("annualOvertime", new Document("$max", "$annualOvertimeMinutes"))
                        .append("limit", new Document("$max", "$annualOvertimeLimitMinutes"))
                        .append("overLimit", sumWhenTrue("$exceedsAnnualOvertimeLimit"))
                        .append("nearLimit", sumWhenTrue("$approachingAnnualOvertimeLimit"))
                        .append("overWeekly", sumWhenTrue("$exceedsWeeklyAverageCap")))));

        // Nothing calculated yet (a new employee, or the cron has not run) — say
        // nothing rather than claiming zero overtime.
        if (summary.isEmpty()) return;

        long overtimeMinutes = asLong(summary.get("annualOvertime"));
        long limitMinutes = asLong(summary.get("limit"));
        boolean overLimit = asLong(summary.get("overLimit")) > 0;
        boolean nearLimit = asLong(summary.get("nearLimit")) > 0;
        boolean overWeekly = asLong(summary.get("overWeekly")) > 0;

        metrics.add(new Metric("my.workpulse.year.overtimeHours", hours(overtimeMinutes),
                "HOURS", overLimit ? "RISK" : nearLimit ? "WARN" : "GOOD", LAW_OVERTIME_LIMIT));
        if (limitMinutes > 0) {
            metrics.add(new Metric("my.workpulse.year.overtimeLimitHours", hours(limitMinutes),
                    "HOURS", "NEUTRAL", LAW_OVERTIME_LIMIT));
        }

        if (overLimit) {
            attention.add(new AttentionItem("WORKPULSE", "MY_WORKPULSE_ANNUAL_OVERTIME_EXCEEDED",
                    1, "RISK", LAW_OVERTIME_LIMIT, ROUTE));
        } else if (nearLimit) {
            attention.add(new AttentionItem("WORKPULSE", "MY_WORKPULSE_ANNUAL_OVERTIME_NEAR",
                    1, "WARN", LAW_OVERTIME_LIMIT, ROUTE));
        }
        if (overWeekly) {
            metrics.add(new Metric("my.workpulse.settlement.overWeeklyAverageCap", "1",
                    "COUNT", "RISK", LAW_WEEKLY_CAP));
            attention.add(new AttentionItem("WORKPULSE", "MY_WORKPULSE_WEEKLY_AVERAGE_CAP_EXCEEDED",
                    1, "RISK", LAW_WEEKLY_CAP, ROUTE));
        }
    }

    // ── The monitoring notice ───────────────────────────────────────────────────

    /**
     * Have I acknowledged the CURRENT monitoring notice?
     *
     * Only asked when the company has actually switched location tracking on. The
     * notice text carries a version, and a new version needs a fresh
     * acknowledgement, so the check compares versions rather than merely asking
     * "has this person ever acknowledged anything".
     */
    private void addMonitoringNotice(String tenantId, String userId,
                                     List<Metric> metrics, List<AttentionItem> attention) {

        Document policy = mongo.findOne(
                Query.query(tenant(tenantId).and("isActive").ne(false).and("isDefault").is(true)),
                Document.class, POLICIES);

        // No policy, or tracking switched off: there is nothing to acknowledge.
        if (policy == null || !Boolean.TRUE.equals(policy.get("locationTrackingEnabled"))) return;

        String version = policy.get("monitoringNoticeVersion") == null
                ? null
                : String.valueOf(policy.get("monitoringNoticeVersion"));
        if (version == null) return;

        Criteria acknowledged = mineByObjectId(tenantId, OWNER, userId)
                .and("noticeVersion").is(version);
        boolean done = count(MONITORING_ACKS, acknowledged) > 0;

        metrics.add(new Metric("my.workpulse.monitoring.acknowledged", done ? "1" : "0",
                "COUNT", done ? "GOOD" : "WARN", LAW_MONITORING));

        if (!done) {
            attention.add(new AttentionItem("WORKPULSE", "MY_WORKPULSE_MONITORING_NOTICE_PENDING",
                    1, "WARN", LAW_MONITORING, ROUTE));
        }
    }

    // ── Tiny aggregation building blocks ────────────────────────────────────────

    /**
     * The "$match" stage every aggregation above starts with: this company AND this
     * person. Built here once so an aggregation cannot forget the owner filter.
     */
    private static Document ownerMatch(String tenantId, String userId) {
        ObjectId id = objectId(userId);
        return new Document("tenantId", tenantId)
                .append(OWNER, id != null ? id : NO_SUCH_ID);
    }

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
