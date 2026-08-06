package com.regulaone.backend.dashboard.reader.personal;

import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.AttentionItem;
import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.Metric;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;

/**
 * Reads the whistleblower reports ASSIGNED TO THIS PERSON in SafeVoice.
 *
 * ── READ THIS BEFORE CHANGING ANYTHING HERE ─────────────────────────────────────
 *
 * Whistleblower confidentiality is a legal duty, not a preference: the reporter's
 * identity — and any detail that could reveal it — may only be seen by the people
 * authorised to handle the report (dyrektywa (UE) 2019/1937 art. 16; ustawa z
 * 14.06.2024 o ochronie sygnalistów, Dz.U. 2024 poz. 928).
 *
 * Two consequences, both enforced rather than merely intended:
 *
 *   1. THE CALLER MUST BE A CASE HANDLER. The dashboard service only invokes this
 *      reader when the person holds a SafeVoice permission code. Without one their
 *      card comes back RESTRICTED and no whistleblower query runs at all.
 *
 *   2. IT READS ONLY THEIR OWN CASELOAD. Every filter includes
 *      "assignedInvestigator = me", so a handler sees the deadlines of the reports
 *      they are responsible for and nothing about anybody else's.
 *
 * WHAT IS NEVER READ: the report text, the attachments, the case reference, the
 * reporter, the encrypted payload — and no breakdown by category, severity or
 * department. In a small company "1 open harassment case in Finance" identifies a
 * person as surely as a name would, so those breakdowns are absent from the API,
 * not merely hidden in the screen.
 *
 * THE TWO STATUTORY CLOCKS THIS CARD EXISTS FOR:
 *   * Acknowledge receipt within 7 days (art. 9(1)(b) of the Directive).
 *   * Give the reporter feedback within 3 months (art. 9(1)(f)).
 * Both are the handler's own deadlines, which is exactly what belongs on their
 * personal dashboard.
 *
 * WHY THE PERSON'S OWN SUBMITTED REPORTS ARE NOT HERE:
 *   SafeVoice deliberately does NOT link a report to the account of whoever sent
 *   it — a report is tracked by a secret PIN instead. That is what makes anonymous
 *   reporting real. So there is no "my reports" figure to show, and adding one
 *   would mean building the very link the design avoids.
 */
@Repository
public class MySafeVoiceReader extends PersonalMetricsSupport {

    private static final String CASES = "safevoice_case_reports";
    private static final String MESSAGES = "safevoice_case_messages";

    /** SafeVoice stores the handler's RegulaOne user id in "assignedInvestigator". */
    private static final String OWNER = "assignedInvestigator";

    private static final String ROUTE = "/modules/safevoice";

    /** Feedback deadlines inside this many days are surfaced as a warning. */
    private static final int FEEDBACK_WARNING_DAYS = 14;

    /**
     * Most a handler's caseload is expected to hold. The unread-message count needs
     * the ids of their open cases, and this caps how many are ever loaded so one
     * enormous caseload cannot slow the dashboard down.
     */
    private static final int MAX_CASES_FOR_MESSAGE_COUNT = 200;

    private static final String LAW_ACK =
            "Dyrektywa (UE) 2019/1937 art. 9(1)(b); ustawa o ochronie sygnalistów (7 dni)";
    private static final String LAW_FEEDBACK =
            "Dyrektywa (UE) 2019/1937 art. 9(1)(f); ustawa o ochronie sygnalistów (3 miesiące)";
    private static final String LAW_HANDLING =
            "Dyrektywa (UE) 2019/1937 art. 9; ustawa o ochronie sygnalistów";

    public MySafeVoiceReader(MongoTemplate mongo) {
        super(mongo);
    }

    public PersonalSnapshot read(String tenantId, String userId) {
        List<Metric> metrics = new ArrayList<>();
        List<AttentionItem> attention = new ArrayList<>();

        // "My live cases": my company, assigned to me, not soft-deleted, still open.
        Criteria mineOpen = mine(tenantId, OWNER, userId)
                .and("deleted").ne(true)
                .and("status").ne("CLOSED");

        long open = count(CASES, mineOpen);

        // Receipt not confirmed although the 7-day window has passed. A case still in
        // RECEIVED means no acknowledgement has been sent to the reporter.
        long ackOverdue = count(CASES, mine(tenantId, OWNER, userId)
                .and("deleted").ne(true)
                .and("status").is("RECEIVED")
                .and("acknowledgementDue").lt(now()));

        // Still open after the 3-month feedback deadline.
        long feedbackOverdue = count(CASES, mine(tenantId, OWNER, userId)
                .and("deleted").ne(true)
                .and("status").ne("CLOSED")
                .and("feedbackDue").lt(now()));

        // Open, and the 3-month deadline lands inside the warning window.
        long feedbackDueSoon = count(CASES, mine(tenantId, OWNER, userId)
                .and("deleted").ne(true)
                .and("status").ne("CLOSED")
                .and("feedbackDue").gte(now()).lt(daysAhead(FEEDBACK_WARNING_DAYS)));

        long unreadReplies = unreadMessagesOnMyCases(tenantId, userId);

        metrics.add(Metric.count("my.safevoice.cases.assignedOpen", open, "NEUTRAL", LAW_HANDLING));
        metrics.add(Metric.count("my.safevoice.cases.acknowledgementOverdue", ackOverdue,
                ackOverdue > 0 ? "RISK" : "GOOD", LAW_ACK));
        metrics.add(Metric.count("my.safevoice.cases.feedbackOverdue", feedbackOverdue,
                feedbackOverdue > 0 ? "RISK" : "GOOD", LAW_FEEDBACK));
        metrics.add(Metric.count("my.safevoice.cases.feedbackDueSoon", feedbackDueSoon,
                feedbackDueSoon > 0 ? "WARN" : "GOOD", LAW_FEEDBACK));
        metrics.add(Metric.count("my.safevoice.messages.unread", unreadReplies,
                unreadReplies > 0 ? "WARN" : "GOOD", LAW_FEEDBACK));

        // ── This handler's to-do list ──────────────────────────────────────────
        if (ackOverdue > 0) {
            attention.add(new AttentionItem("SAFEVOICE", "MY_SAFEVOICE_ACKNOWLEDGEMENT_OVERDUE",
                    (int) ackOverdue, "RISK", LAW_ACK, ROUTE));
        }
        if (feedbackOverdue > 0) {
            attention.add(new AttentionItem("SAFEVOICE", "MY_SAFEVOICE_FEEDBACK_OVERDUE",
                    (int) feedbackOverdue, "RISK", LAW_FEEDBACK, ROUTE));
        }
        if (feedbackDueSoon > 0) {
            attention.add(new AttentionItem("SAFEVOICE", "MY_SAFEVOICE_FEEDBACK_DUE_SOON",
                    (int) feedbackDueSoon, "WARN", LAW_FEEDBACK, ROUTE));
        }
        if (unreadReplies > 0) {
            attention.add(new AttentionItem("SAFEVOICE", "MY_SAFEVOICE_REPORTER_WAITING",
                    (int) unreadReplies, "WARN", LAW_FEEDBACK, ROUTE));
        }

        return PersonalSnapshot.of(metrics, attention);
    }

    /**
     * How many reporter messages on MY open cases nobody on staff has opened yet.
     *
     * Done in two steps because a message record names its case, not its handler:
     * first the ids of my own open cases (ids only — no case content is read), then
     * a count of unread messages pointing at them. A reporter left waiting is both a
     * service failure and a step towards missing the 3-month feedback deadline.
     */
    private long unreadMessagesOnMyCases(String tenantId, String userId) {
        List<Document> rows = aggregate(CASES, List.of(
                new Document("$match", new Document("tenantId", tenantId)
                        .append(OWNER, userId)
                        .append("deleted", new Document("$ne", true))
                        .append("status", new Document("$ne", "CLOSED"))),
                new Document("$limit", MAX_CASES_FOR_MESSAGE_COUNT),
                new Document("$project", new Document("_id", 1))));

        List<String> caseIds = new ArrayList<>(rows.size());
        for (Document row : rows) {
            if (row.get("_id") != null) caseIds.add(String.valueOf(row.get("_id")));
        }
        if (caseIds.isEmpty()) return 0;

        return count(MESSAGES, tenant(tenantId)
                .and("deleted").ne(true)
                .and("readByStaff").is(false)
                .and("caseId").in(caseIds));
    }
}
