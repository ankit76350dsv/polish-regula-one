package com.regulaone.backend.dashboard.reader.personal;

import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.AttentionItem;
import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.Metric;
import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Reads the waste records THIS PERSON entered in WasteSync — nobody else's.
 *
 * WHO THIS CARD IS FOR: the person who actually keys in the monthly packaging-waste
 * figures. Their question is "what have I recorded, and when did I last do it?"
 *
 * WHY THE FIGURES MATTER: waste must be recorded as it arises (ustawa o odpadach
 * art. 66–67), and those monthly records are what the yearly BDO report is built
 * from. Seeing their own entries lets the person spot a month they never keyed in.
 *
 * WHY THERE ARE NO WARNINGS ON THIS CARD — AND THAT IS CORRECT:
 *   Missing months and the 15 March filing deadline (art. 76 ust. 1) are duties of
 *   the COMPANY, not of one employee: whether an entity filed is not something an
 *   individual can be held to. Those figures therefore stay on the company-admin
 *   dashboard, where the person accountable for them looks. Inventing a personal
 *   deadline here would put a legal obligation on the wrong shoulders.
 *
 * Only counts, weights and dates are read — never waste-record details.
 */
@Repository
public class MyWasteSyncReader extends PersonalMetricsSupport {

    private static final String ENTRIES = "wastesync_waste_entries";

    /** WasteSync stamps the person who recorded a version in "createdBy" (text). */
    private static final String OWNER = "createdBy";

    // No ROUTE constant here on purpose: this card raises no to-do items, so there
    // is nothing that needs a deep link into the module (see the class comment).

    private static final String LAW_REGISTER = "Ustawa o odpadach art. 66–67 (ewidencja / BDO)";

    public MyWasteSyncReader(MongoTemplate mongo) {
        super(mongo);
    }

    public PersonalSnapshot read(String tenantId, String userId) {
        List<Metric> metrics = new ArrayList<>();
        List<AttentionItem> attention = new ArrayList<>();

        int year = LocalDate.now(WARSAW).getYear();

        // Only the CURRENT version of each month is counted. WasteSync never edits a
        // record: a correction is saved as a new version and the old one keeps
        // isLatest = false. Counting every version would inflate the figure.
        Document totals = aggregateOne(ENTRIES, List.of(
                new Document("$match", new Document("tenantId", tenantId)
                        .append(OWNER, userId)
                        .append("year", year)
                        .append("isLatest", true)),
                new Document("$group", new Document("_id", null)
                        .append("entries", new Document("$sum", 1))
                        .append("totalKg", new Document("$sum", "$totalWeightKg")))));

        long entriesThisYear = asLong(totals.get("entries"));

        metrics.add(Metric.count("my.wastesync.entries.thisYear", entriesThisYear,
                "NEUTRAL", LAW_REGISTER));
        metrics.add(new Metric("my.wastesync.totals.thisYearKg",
                kilograms(asDouble(totals.get("totalKg"))), "KG", "NEUTRAL", LAW_REGISTER));

        // Corrections this person made. Shown because a corrected month is normal and
        // fully auditable — it is not an error to hide.
        long corrections = count(ENTRIES, mine(tenantId, OWNER, userId)
                .and("year").is(year)
                .and("version").gt(1));
        metrics.add(Metric.count("my.wastesync.entries.corrections", corrections));

        // When did I last record anything? The plainest answer to "am I up to date?".
        Document latest = mongo.findOne(
                Query.query(mine(tenantId, OWNER, userId))
                        .with(Sort.by(Sort.Direction.DESC, "createdAt"))
                        .limit(1),
                Document.class, ENTRIES);

        if (latest != null) {
            String recordedAt = asIsoDay(latest.get("createdAt"));
            if (recordedAt != null) {
                metrics.add(new Metric("my.wastesync.entries.lastRecordedAt", recordedAt,
                        "DATE", "NEUTRAL", LAW_REGISTER));
            }
            // Which month the newest record covers, so the person can see where they
            // stopped. Sent as plain "YYYY-MM" text, formatted by the browser.
            Object entryYear = latest.get("year");
            Object entryMonth = latest.get("month");
            if (entryYear != null && entryMonth != null) {
                metrics.add(new Metric("my.wastesync.entries.lastPeriod",
                        String.format("%s-%02d", entryYear, asLong(entryMonth)),
                        "TEXT", "NEUTRAL", LAW_REGISTER));
            }
        }

        return PersonalSnapshot.of(metrics, attention);
    }
}
