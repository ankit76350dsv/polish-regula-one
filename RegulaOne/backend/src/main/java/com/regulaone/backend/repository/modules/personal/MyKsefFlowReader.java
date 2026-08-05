package com.regulaone.backend.repository.modules.personal;

import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.AttentionItem;
import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.Metric;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;

/**
 * Reads the invoices THIS PERSON issued in KSeFFlow — nobody else's.
 *
 * WHO THIS CARD IS FOR: the person in the company who actually types invoices (an
 * accountant, an office manager). Their question is not "how is the company doing"
 * but "did everything I sent actually reach KSeF, and is anything of mine stuck?"
 *
 * WHY IT MATTERS LEGALLY:
 *   * An invoice that never reaches KSeF is, in law, not properly issued
 *     (ustawa o VAT art. 106na–106nf).
 *   * An invoice issued while KSeF was unreachable may go out offline, but it must
 *     still be uploaded inside the legal window (art. 106nf–106nh). Passing that
 *     window is a real tax exposure, so it is reported as a RISK.
 *   * The UPO is the government receipt proving the filing and must be kept
 *     (art. 112). An accepted invoice with no stored UPO is a missing proof.
 *
 * SCOPE: "createdByUserId" is stamped with the RegulaOne user id of whoever created
 * the invoice, so filtering on it gives exactly this person's own work. Company-wide
 * KSeF totals stay on the admin dashboard.
 *
 * Only counts and money totals are read — never buyer names or invoice contents.
 */
@Repository
public class MyKsefFlowReader extends PersonalMetricsSupport {

    private static final String INVOICES = "ksef_invoices";

    /** KSeFFlow names the creator of an invoice "createdByUserId" and stores text. */
    private static final String OWNER = "createdByUserId";

    private static final String ROUTE = "/modules/ksef";

    private static final String LAW_OFFLINE_DEADLINE = "Ustawa o VAT art. 106nf–106nh (tryb offline)";
    private static final String LAW_INVOICE_RETENTION = "Ustawa o VAT art. 112 (przechowywanie / UPO)";
    private static final String LAW_KSEF_MANDATE = "Ustawa o VAT art. 106na–106nf (KSeF)";

    public MyKsefFlowReader(MongoTemplate mongo) {
        super(mongo);
    }

    public PersonalSnapshot read(String tenantId, String userId) {
        List<Metric> metrics = new ArrayList<>();
        List<AttentionItem> attention = new ArrayList<>();

        // Soft-deleted invoices are kept for the 10-year retention rule but are not
        // live work, so every filter below excludes them.
        Criteria mine = mine(tenantId, OWNER, userId).and("softDeleted").ne(true);

        long total = count(INVOICES, mine);

        // Nothing issued by this person: say so plainly and stop. Running eight more
        // count queries to prove a row of zeroes is wasted work.
        if (total == 0) {
            metrics.add(Metric.count("my.ksef.invoices.created", 0));
            return PersonalSnapshot.of(metrics, attention);
        }

        long draft = countStatus(tenantId, userId, "DRAFT");
        long pending = countStatus(tenantId, userId, "PENDING");
        long sent = countStatus(tenantId, userId, "SENT");
        long failed = countStatus(tenantId, userId, "FAILED");
        long offline = countStatus(tenantId, userId, "OFFLINE_MODE");
        long retrying = countStatus(tenantId, userId, "RETRYING");

        long thisMonth = count(INVOICES, mine(tenantId, OWNER, userId)
                .and("softDeleted").ne(true)
                .and("status").ne("DRAFT")
                .and("createdAt").gte(startOfThisMonth()));

        // Mine, not accepted, and the legal upload deadline has already passed.
        long deadlineBreached = count(INVOICES, mine(tenantId, OWNER, userId)
                .and("softDeleted").ne(true)
                .and("status").ne("SENT")
                .and("ksefSubmissionDeadline").lt(now()));

        // Mine, accepted, but the government receipt was never stored.
        // NONE / GENERATED both mean "we do not hold the UPO document yet".
        long upoMissing = count(INVOICES, mine(tenantId, OWNER, userId)
                .and("softDeleted").ne(true)
                .and("status").is("SENT")
                .and("upoStatus").in("NONE", "GENERATED"));

        metrics.add(Metric.count("my.ksef.invoices.created", total));
        metrics.add(Metric.count("my.ksef.invoices.thisMonth", thisMonth));
        metrics.add(Metric.count("my.ksef.invoices.draft", draft,
                draft > 0 ? "WARN" : "NEUTRAL", null));
        metrics.add(Metric.count("my.ksef.invoices.pending", pending));
        metrics.add(Metric.count("my.ksef.invoices.sent", sent, "GOOD", LAW_KSEF_MANDATE));
        metrics.add(Metric.count("my.ksef.invoices.failed", failed,
                failed > 0 ? "RISK" : "GOOD", LAW_KSEF_MANDATE));
        metrics.add(Metric.count("my.ksef.invoices.offlineQueued", offline + retrying,
                (offline + retrying) > 0 ? "WARN" : "GOOD", LAW_OFFLINE_DEADLINE));
        metrics.add(Metric.count("my.ksef.invoices.deadlineBreached", deadlineBreached,
                deadlineBreached > 0 ? "RISK" : "GOOD", LAW_OFFLINE_DEADLINE));
        metrics.add(Metric.count("my.ksef.upo.missing", upoMissing,
                upoMissing > 0 ? "WARN" : "GOOD", LAW_INVOICE_RETENTION));

        // ── This person's to-do list ───────────────────────────────────────────
        if (deadlineBreached > 0) {
            attention.add(new AttentionItem("KSEFFLOW", "MY_KSEF_SUBMISSION_DEADLINE_BREACHED",
                    (int) deadlineBreached, "RISK", LAW_OFFLINE_DEADLINE, ROUTE));
        }
        if (failed > 0) {
            attention.add(new AttentionItem("KSEFFLOW", "MY_KSEF_INVOICES_FAILED",
                    (int) failed, "RISK", LAW_KSEF_MANDATE, ROUTE));
        }
        if (offline + retrying > 0) {
            attention.add(new AttentionItem("KSEFFLOW", "MY_KSEF_OFFLINE_QUEUE",
                    (int) (offline + retrying), "WARN", LAW_OFFLINE_DEADLINE, ROUTE));
        }
        if (upoMissing > 0) {
            attention.add(new AttentionItem("KSEFFLOW", "MY_KSEF_UPO_MISSING",
                    (int) upoMissing, "WARN", LAW_INVOICE_RETENTION, ROUTE));
        }
        if (draft > 0) {
            // Not a legal breach — a draft was never issued — so it is deliberately
            // NEUTRAL and sorts below the real deadlines. It is still listed because
            // it is unfinished work only this person can finish, which is what this
            // screen is for.
            attention.add(new AttentionItem("KSEFFLOW", "MY_KSEF_DRAFTS_UNFINISHED",
                    (int) draft, "NEUTRAL", null, ROUTE));
        }

        return PersonalSnapshot.of(metrics, attention);
    }

    private long countStatus(String tenantId, String userId, String status) {
        return count(INVOICES, mine(tenantId, OWNER, userId)
                .and("softDeleted").ne(true)
                .and("status").is(status));
    }
}
