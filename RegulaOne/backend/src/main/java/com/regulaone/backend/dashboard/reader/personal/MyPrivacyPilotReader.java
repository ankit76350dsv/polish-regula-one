package com.regulaone.backend.dashboard.reader.personal;

import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.AttentionItem;
import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.Metric;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

/**
 * Reads the GDPR/RODO records THIS PERSON created in PrivacyPilot — nobody else's.
 *
 * WHO THIS CARD IS FOR: somebody who does data-protection work in the company (a
 * privacy officer, a department owner keeping their part of the register). Their
 * question is "what have I put in the register, and is any of MY paperwork late?"
 *
 * WHY THE DEADLINES ARE REAL, NOT DECORATION:
 *   * A register entry that is past its review date may no longer be accurate,
 *     which is itself an art. 30 problem.
 *   * A breach that must be reported to UODO has 72 hours from the company becoming
 *     aware of it (art. 33(1)). Somebody has to actually send it.
 *   * A data-subject request must normally be answered within one month
 *     (art. 12(3), art. 15–22).
 *   The 72-hour and one-month clocks are computed HERE, on the server, with the
 *   same rules the company dashboard and PrivacyPilot itself use, so no two screens
 *   can show a different deadline.
 *
 * SCOPE: PrivacyPilot fills "createdBy" automatically with the RegulaOne user id of
 * whoever saved the record, so filtering on it gives exactly this person's own work.
 * Company-wide GDPR figures — the full register, every breach, every processor —
 * stay on the admin dashboard.
 *
 * PRIVACY NOTE — WHAT IS DELIBERATELY LEFT OUT:
 *   A data-subject request holds the requester's name and e-mail; a breach record
 *   describes real people's data. None of that is read. This reader counts records
 *   and compares dates, nothing more. The GDPR screen must itself be minimal
 *   (art. 5(1)(c)).
 */
@Repository
public class MyPrivacyPilotReader extends PersonalMetricsSupport {

    private static final String ACTIVITIES = "privacypilot_activities";
    private static final String DPIAS = "privacypilot_dpias";
    private static final String BREACHES = "privacypilot_breaches";
    private static final String DSARS = "privacypilot_dsars";

    /** PrivacyPilot's shared base record stamps the author in "createdBy" (text). */
    private static final String OWNER = "createdBy";

    private static final String ROUTE = "/modules/privacypilot";

    /** A request due within a working week is treated as urgent. */
    private static final int DSAR_URGENT_DAYS = 7;

    /** The UODO reporting window, in hours (art. 33(1)). */
    private static final int UODO_WINDOW_HOURS = 72;

    private static final String LAW_ROPA = "RODO art. 30 (rejestr czynności przetwarzania)";
    private static final String LAW_DPIA = "RODO art. 35 (ocena skutków — DPIA)";
    private static final String LAW_BREACH_UODO = "RODO art. 33 (zgłoszenie do UODO w 72 h)";
    private static final String LAW_DSAR = "RODO art. 12 ust. 3, art. 15–22 (1 miesiąc)";

    public MyPrivacyPilotReader(MongoTemplate mongo) {
        super(mongo);
    }

    public PersonalSnapshot read(String tenantId, String userId) {
        List<Metric> metrics = new ArrayList<>();
        List<AttentionItem> attention = new ArrayList<>();

        // Every filter starts from "this company, me, and not soft-deleted".
        Criteria mine = mine(tenantId, OWNER, userId).and("deleted").ne(true);

        // ── The register entries I wrote (art. 30) ──────────────────────────────
        long activities = count(ACTIVITIES, mine);
        long reviewOverdue = count(ACTIVITIES, mine(tenantId, OWNER, userId)
                .and("deleted").ne(true)
                .and("reviewAt").ne(null).lt(now()));

        metrics.add(Metric.count("my.privacypilot.activities.created", activities,
                "NEUTRAL", LAW_ROPA));
        metrics.add(Metric.count("my.privacypilot.activities.reviewOverdue", reviewOverdue,
                reviewOverdue > 0 ? "WARN" : "GOOD", LAW_ROPA));

        // Screened as "needs a DPIA" but no DPIA has been started on my entry. The
        // processing may be running without its assessment (art. 35).
        long dpiaRequired = count(ACTIVITIES, mine(tenantId, OWNER, userId)
                .and("deleted").ne(true)
                .and("dpiaVerdict").is("REQUIRED")
                .and("dpiaId").is(null));

        long dpiaInProgress = count(DPIAS, mine(tenantId, OWNER, userId)
                .and("deleted").ne(true)
                .and("status").is("IN_PROGRESS"));

        metrics.add(Metric.count("my.privacypilot.dpia.required", dpiaRequired,
                dpiaRequired > 0 ? "RISK" : "GOOD", LAW_DPIA));
        metrics.add(Metric.count("my.privacypilot.dpia.inProgress", dpiaInProgress,
                "NEUTRAL", LAW_DPIA));

        // ── The breaches I logged (art. 33) ────────────────────────────────────
        // The 72-hour clock is expressed as a date comparison rather than arithmetic
        // inside the database: a breach discovered BEFORE this cutoff is already late.
        Date uodoCutoff = Date.from(java.time.Instant.now()
                .minusSeconds(UODO_WINDOW_HOURS * 3600L));

        long breachesOpen = count(BREACHES, mine(tenantId, OWNER, userId)
                .and("deleted").ne(true)
                .and("status").is("OPEN"));

        long uodoOverdue = count(BREACHES, mine(tenantId, OWNER, userId)
                .and("deleted").ne(true)
                .and("uodoNotificationRequired").is(true)
                .and("uodoNotifiedAt").is(null)
                .and("discoveredAt").ne(null).lt(uodoCutoff));

        long uodoTicking = count(BREACHES, mine(tenantId, OWNER, userId)
                .and("deleted").ne(true)
                .and("uodoNotificationRequired").is(true)
                .and("uodoNotifiedAt").is(null)
                .and("discoveredAt").gte(uodoCutoff));

        metrics.add(Metric.count("my.privacypilot.breaches.open", breachesOpen,
                breachesOpen > 0 ? "WARN" : "GOOD", LAW_BREACH_UODO));
        metrics.add(Metric.count("my.privacypilot.breaches.uodoWindowOpen", uodoTicking,
                uodoTicking > 0 ? "WARN" : "GOOD", LAW_BREACH_UODO));
        metrics.add(Metric.count("my.privacypilot.breaches.uodoOverdue", uodoOverdue,
                uodoOverdue > 0 ? "RISK" : "GOOD", LAW_BREACH_UODO));

        // ── The data-subject requests I am handling (art. 12(3), 15–22) ─────────
        // COMPLETED and REFUSED are both finished; only IN_PROGRESS is still owed.
        long dsarOpen = count(DSARS, mine(tenantId, OWNER, userId)
                .and("deleted").ne(true)
                .and("status").is("IN_PROGRESS"));

        long dsarOverdue = count(DSARS, mine(tenantId, OWNER, userId)
                .and("deleted").ne(true)
                .and("status").is("IN_PROGRESS")
                .and("dueAt").ne(null).lt(now()));

        long dsarDueSoon = count(DSARS, mine(tenantId, OWNER, userId)
                .and("deleted").ne(true)
                .and("status").is("IN_PROGRESS")
                .and("dueAt").gte(now()).lt(daysAhead(DSAR_URGENT_DAYS)));

        metrics.add(Metric.count("my.privacypilot.dsar.open", dsarOpen, "NEUTRAL", LAW_DSAR));
        metrics.add(Metric.count("my.privacypilot.dsar.dueSoon", dsarDueSoon,
                dsarDueSoon > 0 ? "WARN" : "GOOD", LAW_DSAR));
        metrics.add(Metric.count("my.privacypilot.dsar.overdue", dsarOverdue,
                dsarOverdue > 0 ? "RISK" : "GOOD", LAW_DSAR));

        // ── This person's to-do list ───────────────────────────────────────────
        if (uodoOverdue > 0) {
            attention.add(new AttentionItem("PRIVACYPILOT", "MY_PRIVACY_BREACH_UODO_OVERDUE",
                    (int) uodoOverdue, "RISK", LAW_BREACH_UODO, ROUTE));
        }
        if (uodoTicking > 0) {
            attention.add(new AttentionItem("PRIVACYPILOT", "MY_PRIVACY_BREACH_UODO_WINDOW",
                    (int) uodoTicking, "RISK", LAW_BREACH_UODO, ROUTE));
        }
        if (dsarOverdue > 0) {
            attention.add(new AttentionItem("PRIVACYPILOT", "MY_PRIVACY_DSAR_OVERDUE",
                    (int) dsarOverdue, "RISK", LAW_DSAR, ROUTE));
        }
        if (dpiaRequired > 0) {
            attention.add(new AttentionItem("PRIVACYPILOT", "MY_PRIVACY_DPIA_REQUIRED",
                    (int) dpiaRequired, "RISK", LAW_DPIA, ROUTE));
        }
        if (dsarDueSoon > 0) {
            attention.add(new AttentionItem("PRIVACYPILOT", "MY_PRIVACY_DSAR_DUE_SOON",
                    (int) dsarDueSoon, "WARN", LAW_DSAR, ROUTE));
        }
        if (reviewOverdue > 0) {
            attention.add(new AttentionItem("PRIVACYPILOT", "MY_PRIVACY_ROPA_REVIEW_OVERDUE",
                    (int) reviewOverdue, "WARN", LAW_ROPA, ROUTE));
        }

        return PersonalSnapshot.of(metrics, attention);
    }
}
