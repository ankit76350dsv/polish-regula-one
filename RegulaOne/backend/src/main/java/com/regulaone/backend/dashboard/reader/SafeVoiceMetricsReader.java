package com.regulaone.backend.dashboard.reader;

import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.AttentionItem;
import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.Metric;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;

/**
 * Reads the SafeVoice (whistleblower) numbers for one company.
 *
 * WHAT SafeVoice DOES: it receives internal whistleblower reports, keeps the
 * reporter's identity confidential, and tracks the two deadlines the law sets for
 * answering them.
 *
 * ── THIS IS THE MOST RESTRICTED CARD ON THE DASHBOARD ──────────────────────────
 *
 * Whistleblower confidentiality is not a preference, it is a legal duty: the
 * reporter's identity — and any detail that could reveal it — may only be seen by
 * the people authorised to handle the report (dyrektywa (UE) 2019/1937 art. 16;
 * ustawa z 14.06.2024 o ochronie sygnalistów, Dz.U. 2024 poz. 928). A company
 * administrator is NOT automatically one of those people.
 *
 * So this reader is written to make a leak impossible rather than merely unlikely:
 *
 *   * It returns ONLY whole-company counts and deadline arithmetic.
 *   * It NEVER reads the report text, the attachments, the case reference, the
 *     reporter, the assigned investigator's name, or any encrypted payload.
 *   * It NEVER breaks the numbers down by category, severity, department or
 *     disclosure mode. In a small company, "1 open harassment case in Finance"
 *     can identify a person as surely as a name would, so those breakdowns are
 *     deliberately absent — not merely hidden in the UI.
 *   * The caller must additionally hold a SafeVoice staff permission before this
 *     reader is even invoked (enforced by the dashboard service). Without it the
 *     card is returned as RESTRICTED and no query runs at all.
 *
 * THE TWO STATUTORY CLOCKS THIS CARD EXISTS FOR:
 *   * Acknowledge receipt within 7 days (art. 9(1)(b) of the Directive).
 *   * Give the reporter feedback within 3 months (art. 9(1)(f)).
 * Missing either is the company's own breach, which is exactly the kind of thing a
 * compliance overview must surface — hence counts, and only counts.
 */
@Repository
public class SafeVoiceMetricsReader extends ModuleMetricsSupport {

    private static final String CASES = "safevoice_case_reports";
    private static final String MESSAGES = "safevoice_case_messages";
    private static final String AUDIT = "safevoice_audit_logs";

    private static final String ROUTE = "/modules/safevoice";

    // Feedback deadlines inside this many days are surfaced as a warning, so staff
    // have time to answer before the 3-month limit runs out.
    private static final int FEEDBACK_WARNING_DAYS = 14;

    private static final String LAW_ACK =
            "Dyrektywa (UE) 2019/1937 art. 9(1)(b); ustawa o ochronie sygnalistów (7 dni)";
    private static final String LAW_FEEDBACK =
            "Dyrektywa (UE) 2019/1937 art. 9(1)(f); ustawa o ochronie sygnalistów (3 miesiące)";
    private static final String LAW_HANDLING =
            "Dyrektywa (UE) 2019/1937 art. 9; ustawa o ochronie sygnalistów";

    public SafeVoiceMetricsReader(MongoTemplate mongo) {
        super(mongo);
    }

    public ModuleSnapshot read(String tenantId) {
        List<Metric> metrics = new ArrayList<>();
        List<AttentionItem> attention = new ArrayList<>();

        // Every filter below is: this company, not soft-deleted, still open.
        long open = count(CASES, tenant(tenantId)
                .and("deleted").ne(true)
                .and("status").ne("CLOSED"));

        // Receipt not yet confirmed although the 7-day window has passed.
        // A case still in RECEIVED means no acknowledgement has been sent.
        long ackOverdue = count(CASES, tenant(tenantId)
                .and("deleted").ne(true)
                .and("status").is("RECEIVED")
                .and("acknowledgementDue").lt(now()));

        // Still open after the 3-month feedback deadline.
        long feedbackOverdue = count(CASES, tenant(tenantId)
                .and("deleted").ne(true)
                .and("status").ne("CLOSED")
                .and("feedbackDue").lt(now()));

        // Open and the 3-month deadline lands inside the warning window.
        long feedbackDueSoon = count(CASES, tenant(tenantId)
                .and("deleted").ne(true)
                .and("status").ne("CLOSED")
                .and("feedbackDue").gte(now()).lt(daysAhead(FEEDBACK_WARNING_DAYS)));

        // Open with nobody responsible yet. Counted, never listed — an unassigned
        // case list would expose which reports exist.
        long unassigned = count(CASES, tenant(tenantId)
                .and("deleted").ne(true)
                .and("status").ne("CLOSED")
                .and("assignedInvestigator").is(null));

        // Reporter replies staff have not opened. A reporter left waiting is both
        // a service failure and a step towards missing the feedback deadline.
        long unreadReplies = count(MESSAGES, tenant(tenantId)
                .and("deleted").ne(true)
                .and("readByStaff").is(false));

        // Size of the tamper-evident audit trail. Proof the handling process is
        // being recorded; the entries themselves are never read here.
        long auditEntries = count(AUDIT, tenant(tenantId));

        // Share of open cases still inside their feedback deadline. With no open
        // cases nothing can be late, so a clean 100 % is reported.
        int withinSla = percent(open - feedbackOverdue, open);

        metrics.add(Metric.count("safevoice.cases.open", open, "NEUTRAL", LAW_HANDLING));
        metrics.add(Metric.count("safevoice.cases.acknowledgementOverdue", ackOverdue,
                ackOverdue > 0 ? "RISK" : "GOOD", LAW_ACK));
        metrics.add(Metric.count("safevoice.cases.feedbackOverdue", feedbackOverdue,
                feedbackOverdue > 0 ? "RISK" : "GOOD", LAW_FEEDBACK));
        metrics.add(Metric.count("safevoice.cases.feedbackDueSoon", feedbackDueSoon,
                feedbackDueSoon > 0 ? "WARN" : "GOOD", LAW_FEEDBACK));
        metrics.add(Metric.count("safevoice.cases.unassigned", unassigned,
                unassigned > 0 ? "WARN" : "GOOD", LAW_HANDLING));
        metrics.add(Metric.count("safevoice.messages.unreadByStaff", unreadReplies,
                unreadReplies > 0 ? "WARN" : "GOOD", LAW_FEEDBACK));
        metrics.add(new Metric("safevoice.cases.withinSlaPct", Integer.toString(withinSla),
                "PERCENT", withinSla >= 100 ? "GOOD" : "RISK", LAW_FEEDBACK));
        metrics.add(Metric.count("safevoice.audit.entries", auditEntries));

        // ── Attention list ─────────────────────────────────────────────────────
        if (ackOverdue > 0) {
            attention.add(new AttentionItem("SAFEVOICE", "SAFEVOICE_ACKNOWLEDGEMENT_OVERDUE",
                    (int) ackOverdue, "RISK", LAW_ACK, ROUTE));
        }
        if (feedbackOverdue > 0) {
            attention.add(new AttentionItem("SAFEVOICE", "SAFEVOICE_FEEDBACK_OVERDUE",
                    (int) feedbackOverdue, "RISK", LAW_FEEDBACK, ROUTE));
        }
        if (feedbackDueSoon > 0) {
            attention.add(new AttentionItem("SAFEVOICE", "SAFEVOICE_FEEDBACK_DUE_SOON",
                    (int) feedbackDueSoon, "WARN", LAW_FEEDBACK, ROUTE));
        }
        if (unassigned > 0) {
            attention.add(new AttentionItem("SAFEVOICE", "SAFEVOICE_CASE_UNASSIGNED",
                    (int) unassigned, "WARN", LAW_HANDLING, ROUTE));
        }
        if (unreadReplies > 0) {
            attention.add(new AttentionItem("SAFEVOICE", "SAFEVOICE_REPORTER_WAITING",
                    (int) unreadReplies, "WARN", LAW_FEEDBACK, ROUTE));
        }

        return new ModuleSnapshot(metrics, attention);
    }
}
