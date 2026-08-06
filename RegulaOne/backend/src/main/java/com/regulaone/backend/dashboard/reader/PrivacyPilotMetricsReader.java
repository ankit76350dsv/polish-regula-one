package com.regulaone.backend.dashboard.reader;

import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.AttentionItem;
import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.Metric;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

/**
 * Reads the PrivacyPilot (GDPR / RODO) numbers for one company.
 *
 * WHAT PrivacyPilot DOES: it holds the company's data-protection paperwork — the
 * record of processing activities (ROPA), impact assessments (DPIA), personal-data
 * breaches, data-subject requests (DSAR), processor contracts and transfers
 * outside the EEA.
 *
 * WHY THESE NUMBERS MATTER LEGALLY — each one is a live GDPR deadline or duty:
 *   * ROPA must exist and stay accurate (art. 30).
 *   * A DPIA must be done BEFORE high-risk processing starts (art. 35), and the
 *     supervisory authority must be consulted first in some cases (art. 36).
 *   * A personal-data breach must be reported to UODO within 72 hours of the
 *     company becoming aware of it (art. 33), and affected people must be told
 *     when the risk to them is high (art. 34).
 *   * A data-subject request must normally be answered within one month
 *     (art. 12(3), art. 15–22).
 *   * Every processor needs a written contract (art. 28), and every transfer out
 *     of the EEA needs a lawful mechanism (Chapter V, art. 46).
 *
 * The 72-hour and one-month clocks are computed HERE, on the server, using the
 * same rules PrivacyPilot's own dashboard uses — so both screens always agree.
 *
 * PRIVACY NOTE — WHAT IS DELIBERATELY LEFT OUT:
 *   A data-subject request contains the requester's name and e-mail; a breach
 *   record describes real people's data. None of that is read. This reader counts
 *   records and compares dates, nothing more. Ironically but importantly, the GDPR
 *   dashboard must itself be minimal (art. 5(1)(c)).
 */
@Repository
public class PrivacyPilotMetricsReader extends ModuleMetricsSupport {

    private static final String ACTIVITIES = "privacypilot_activities";
    private static final String DPIAS = "privacypilot_dpias";
    private static final String BREACHES = "privacypilot_breaches";
    private static final String DSARS = "privacypilot_dsars";
    private static final String VENDORS = "privacypilot_vendors";
    private static final String TRANSFERS = "privacypilot_transfers";
    private static final String NOTICES = "privacypilot_notices";

    private static final String ROUTE = "/modules/privacypilot";

    /** A request due within a working week is treated as urgent. */
    private static final int DSAR_URGENT_DAYS = 7;

    /** The UODO reporting window, in hours (art. 33(1)). */
    private static final int UODO_WINDOW_HOURS = 72;

    private static final String LAW_ROPA = "RODO art. 30 (rejestr czynności przetwarzania)";
    private static final String LAW_DPIA = "RODO art. 35 (ocena skutków — DPIA)";
    private static final String LAW_PRIOR_CONSULT = "RODO art. 36 (uprzednie konsultacje z UODO)";
    private static final String LAW_BREACH_UODO = "RODO art. 33 (zgłoszenie do UODO w 72 h)";
    private static final String LAW_BREACH_SUBJECTS = "RODO art. 34 (zawiadomienie osób)";
    private static final String LAW_DSAR = "RODO art. 12 ust. 3, art. 15–22 (1 miesiąc)";
    private static final String LAW_PROCESSOR = "RODO art. 28 (umowa powierzenia)";
    private static final String LAW_TRANSFER = "RODO rozdział V, art. 46 (transfery poza EOG)";

    public PrivacyPilotMetricsReader(MongoTemplate mongo) {
        super(mongo);
    }

    public ModuleSnapshot read(String tenantId) {
        List<Metric> metrics = new ArrayList<>();
        List<AttentionItem> attention = new ArrayList<>();

        // Every filter starts from "this company, not soft-deleted".
        // ── Record of processing activities (art. 30) ───────────────────────────
        long activities = count(ACTIVITIES, tenant(tenantId).and("deleted").ne(true));

        // An activity whose scheduled review date has passed — the register may no
        // longer be accurate, which is itself an art. 30 problem.
        long reviewOverdue = count(ACTIVITIES, tenant(tenantId).and("deleted").ne(true)
                .and("reviewAt").ne(null).lt(now()));

        metrics.add(Metric.count("privacypilot.ropa.activities", activities,
                activities > 0 ? "GOOD" : "WARN", LAW_ROPA));
        metrics.add(Metric.count("privacypilot.ropa.reviewOverdue", reviewOverdue,
                reviewOverdue > 0 ? "WARN" : "GOOD", LAW_ROPA));

        // ── Impact assessments (art. 35–36) ────────────────────────────────────
        // Screened as "DPIA required" but no DPIA has been started yet. This is the
        // real backlog: the processing may be running without its assessment.
        long dpiaRequired = count(ACTIVITIES, tenant(tenantId).and("deleted").ne(true)
                .and("dpiaVerdict").is("REQUIRED")
                .and("dpiaId").is(null));

        long dpiaInProgress = count(DPIAS, tenant(tenantId).and("deleted").ne(true)
                .and("status").is("IN_PROGRESS"));

        // Prior consultation with UODO is needed but the DPIA is not approved yet.
        long priorConsultation = count(DPIAS, tenant(tenantId).and("deleted").ne(true)
                .and("priorConsultation").is(true)
                .and("status").ne("APPROVED"));

        metrics.add(Metric.count("privacypilot.dpia.required", dpiaRequired,
                dpiaRequired > 0 ? "RISK" : "GOOD", LAW_DPIA));
        metrics.add(Metric.count("privacypilot.dpia.inProgress", dpiaInProgress,
                "NEUTRAL", LAW_DPIA));
        metrics.add(Metric.count("privacypilot.dpia.priorConsultationPending", priorConsultation,
                priorConsultation > 0 ? "RISK" : "GOOD", LAW_PRIOR_CONSULT));

        // ── Personal-data breaches (art. 33–34) ────────────────────────────────
        // The 72-hour clock is expressed as a date comparison rather than
        // arithmetic inside the database: a breach discovered BEFORE this cutoff is
        // already past its deadline.
        Date uodoCutoff = Date.from(java.time.Instant.now()
                .minusSeconds(UODO_WINDOW_HOURS * 3600L));

        long breachesOpen = count(BREACHES, tenant(tenantId).and("deleted").ne(true)
                .and("status").is("OPEN"));

        // Reportable, not yet reported, and the 72 hours have run out.
        long uodoOverdue = count(BREACHES, tenant(tenantId).and("deleted").ne(true)
                .and("uodoNotificationRequired").is(true)
                .and("uodoNotifiedAt").is(null)
                .and("discoveredAt").ne(null).lt(uodoCutoff));

        // Reportable, not yet reported, still inside the 72 hours — act now.
        long uodoTicking = count(BREACHES, tenant(tenantId).and("deleted").ne(true)
                .and("uodoNotificationRequired").is(true)
                .and("uodoNotifiedAt").is(null)
                .and("discoveredAt").gte(uodoCutoff));

        // High risk to individuals, so they must be told — and have not been.
        long subjectsPending = count(BREACHES, tenant(tenantId).and("deleted").ne(true)
                .and("subjectsNotificationRequired").is(true)
                .and("subjectsNotifiedAt").is(null));

        metrics.add(Metric.count("privacypilot.breaches.open", breachesOpen,
                breachesOpen > 0 ? "WARN" : "GOOD", LAW_BREACH_UODO));
        metrics.add(Metric.count("privacypilot.breaches.uodoWindowOpen", uodoTicking,
                uodoTicking > 0 ? "WARN" : "GOOD", LAW_BREACH_UODO));
        metrics.add(Metric.count("privacypilot.breaches.uodoOverdue", uodoOverdue,
                uodoOverdue > 0 ? "RISK" : "GOOD", LAW_BREACH_UODO));
        metrics.add(Metric.count("privacypilot.breaches.subjectsNotificationPending", subjectsPending,
                subjectsPending > 0 ? "RISK" : "GOOD", LAW_BREACH_SUBJECTS));

        // ── Data-subject requests (art. 12(3), 15–22) ──────────────────────────
        // COMPLETED and REFUSED are both finished; only IN_PROGRESS is still owed.
        long dsarOpen = count(DSARS, tenant(tenantId).and("deleted").ne(true)
                .and("status").is("IN_PROGRESS"));

        long dsarOverdue = count(DSARS, tenant(tenantId).and("deleted").ne(true)
                .and("status").is("IN_PROGRESS")
                .and("dueAt").ne(null).lt(now()));

        long dsarUrgent = count(DSARS, tenant(tenantId).and("deleted").ne(true)
                .and("status").is("IN_PROGRESS")
                .and("dueAt").gte(now()).lt(daysAhead(DSAR_URGENT_DAYS)));

        metrics.add(Metric.count("privacypilot.dsar.open", dsarOpen, "NEUTRAL", LAW_DSAR));
        metrics.add(Metric.count("privacypilot.dsar.dueSoon", dsarUrgent,
                dsarUrgent > 0 ? "WARN" : "GOOD", LAW_DSAR));
        metrics.add(Metric.count("privacypilot.dsar.overdue", dsarOverdue,
                dsarOverdue > 0 ? "RISK" : "GOOD", LAW_DSAR));

        // ── Processors and international transfers (art. 28, Chapter V) ─────────
        long vendors = count(VENDORS, tenant(tenantId).and("deleted").ne(true));
        long dpaMissing = count(VENDORS, tenant(tenantId).and("deleted").ne(true)
                .and("dpaStatus").is("MISSING"));

        long transfers = count(TRANSFERS, tenant(tenantId).and("deleted").ne(true));
        // Standard contractual clauses, binding corporate rules and derogations all
        // need a documented transfer impact assessment; an adequacy decision does not.
        long transfersWithoutTia = count(TRANSFERS, tenant(tenantId).and("deleted").ne(true)
                .and("mechanism").in("SCC", "BCR", "DEROGATION")
                .and("tiaDocumented").ne(true));

        metrics.add(Metric.count("privacypilot.vendors.total", vendors));
        metrics.add(Metric.count("privacypilot.vendors.dpaMissing", dpaMissing,
                dpaMissing > 0 ? "RISK" : "GOOD", LAW_PROCESSOR));
        metrics.add(Metric.count("privacypilot.transfers.total", transfers));
        metrics.add(Metric.count("privacypilot.transfers.withoutTia", transfersWithoutTia,
                transfersWithoutTia > 0 ? "WARN" : "GOOD", LAW_TRANSFER));

        // ── Privacy notices (art. 13–14) ───────────────────────────────────────
        long notices = count(NOTICES, tenant(tenantId).and("deleted").ne(true));
        metrics.add(Metric.count("privacypilot.notices.published", notices,
                notices > 0 ? "GOOD" : "WARN", "RODO art. 13–14 (informowanie osób)"));

        // ── Attention list ─────────────────────────────────────────────────────
        if (uodoOverdue > 0) {
            attention.add(new AttentionItem("PRIVACYPILOT", "PRIVACY_BREACH_UODO_OVERDUE",
                    (int) uodoOverdue, "RISK", LAW_BREACH_UODO, ROUTE));
        }
        if (uodoTicking > 0) {
            attention.add(new AttentionItem("PRIVACYPILOT", "PRIVACY_BREACH_UODO_WINDOW",
                    (int) uodoTicking, "RISK", LAW_BREACH_UODO, ROUTE));
        }
        if (subjectsPending > 0) {
            attention.add(new AttentionItem("PRIVACYPILOT", "PRIVACY_BREACH_SUBJECTS_PENDING",
                    (int) subjectsPending, "RISK", LAW_BREACH_SUBJECTS, ROUTE));
        }
        if (dsarOverdue > 0) {
            attention.add(new AttentionItem("PRIVACYPILOT", "PRIVACY_DSAR_OVERDUE",
                    (int) dsarOverdue, "RISK", LAW_DSAR, ROUTE));
        }
        if (dsarUrgent > 0) {
            attention.add(new AttentionItem("PRIVACYPILOT", "PRIVACY_DSAR_DUE_SOON",
                    (int) dsarUrgent, "WARN", LAW_DSAR, ROUTE));
        }
        if (dpiaRequired > 0) {
            attention.add(new AttentionItem("PRIVACYPILOT", "PRIVACY_DPIA_REQUIRED",
                    (int) dpiaRequired, "RISK", LAW_DPIA, ROUTE));
        }
        if (priorConsultation > 0) {
            attention.add(new AttentionItem("PRIVACYPILOT", "PRIVACY_PRIOR_CONSULTATION",
                    (int) priorConsultation, "RISK", LAW_PRIOR_CONSULT, ROUTE));
        }
        if (dpaMissing > 0) {
            attention.add(new AttentionItem("PRIVACYPILOT", "PRIVACY_VENDOR_DPA_MISSING",
                    (int) dpaMissing, "WARN", LAW_PROCESSOR, ROUTE));
        }
        if (transfersWithoutTia > 0) {
            attention.add(new AttentionItem("PRIVACYPILOT", "PRIVACY_TRANSFER_TIA_MISSING",
                    (int) transfersWithoutTia, "WARN", LAW_TRANSFER, ROUTE));
        }
        if (reviewOverdue > 0) {
            attention.add(new AttentionItem("PRIVACYPILOT", "PRIVACY_ROPA_REVIEW_OVERDUE",
                    (int) reviewOverdue, "WARN", LAW_ROPA, ROUTE));
        }

        return new ModuleSnapshot(metrics, attention);
    }
}
