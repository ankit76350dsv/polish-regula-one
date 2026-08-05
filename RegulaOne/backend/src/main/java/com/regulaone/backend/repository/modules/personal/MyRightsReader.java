package com.regulaone.backend.repository.modules.personal;

import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;

/**
 * Reads the small amount of information the company OWES every one of its people.
 *
 * WHY THIS EXISTS AS ITS OWN READER:
 *   The other personal readers answer "what work is mine?". This one answers a
 *   different question — "what am I entitled to be told?" — and the law is explicit
 *   about it:
 *
 *   * GDPR Art. 13–14 require the company to tell people how their personal data is
 *     used, and Art. 13(1)(b) requires the data-protection officer's contact details
 *     to be provided to them. An employee should not have to hunt for either.
 *
 *   * The Polish whistleblower act (ustawa z 14.06.2024 o ochronie sygnalistów,
 *     Dz.U. 2024 poz. 928, implementing dyrektywa (UE) 2019/1937) requires the
 *     internal reporting procedure to be communicated to the people who may use it.
 *     A channel nobody has been told about does not satisfy that duty.
 *
 * WHAT IT READS — AND HOW LITTLE:
 *   Only "how many privacy notices exist", "when was the newest one issued" and the
 *   DPO's name and e-mail. It never reads a notice's text, never touches the
 *   register, and never touches a whistleblower case. Whether a reporting channel
 *   exists is decided from the company's plan by the caller, not from case data —
 *   so this reader cannot see a single report.
 *
 *   The DPO's name and work e-mail are business contact details the company is
 *   REQUIRED to publish to data subjects, which is why showing them to an employee
 *   is the point rather than a leak.
 */
@Repository
public class MyRightsReader extends PersonalMetricsSupport {

    private static final String NOTICES = "privacypilot_notices";
    private static final String SETTINGS = "privacypilot_settings";

    public MyRightsReader(MongoTemplate mongo) {
        super(mongo);
    }

    /**
     * What one company currently publishes to its people.
     *
     * @param tenantId the caller's own company, resolved from their session
     */
    public Transparency read(String tenantId) {
        long notices = count(NOTICES, tenant(tenantId).and("deleted").ne(true));

        // The newest notice, so the screen can say when the information was last
        // refreshed. Only the date is projected — never the notice text.
        Query newest = Query.query(tenant(tenantId).and("deleted").ne(true))
                .with(Sort.by(Sort.Direction.DESC, "generatedAt"))
                .limit(1);
        newest.fields().include("generatedAt");

        Document latest = mongo.findOne(newest, Document.class, NOTICES);
        Instant latestAt = latest == null ? null : instant(latest.get("generatedAt"));

        // The appointed data-protection officer, if the company has recorded one.
        Document settings = mongo.findOne(
                Query.query(Criteria.where("tenantId").is(tenantId)), Document.class, SETTINGS);

        String dpoName = text(nested(settings, "dpo", "name"));
        String dpoEmail = text(nested(settings, "dpo", "email"));

        return new Transparency(notices, latestAt, dpoName, dpoEmail);
    }

    /** Text out of a raw BSON value, with blanks normalised to null. */
    private static String text(Object value) {
        if (value == null) return null;
        String asText = String.valueOf(value).trim();
        return asText.isEmpty() ? null : asText;
    }

    /**
     * The transparency facts, ready for the response.
     *
     * @param noticeCount how many privacy notices the company has issued
     * @param latestAt    when the newest one was issued (null when there are none)
     * @param dpoName     the appointed officer's name, or null when none is recorded
     * @param dpoEmail    the officer's contact address, or null
     */
    public record Transparency(long noticeCount, Instant latestAt, String dpoName, String dpoEmail) {

        /** Nothing published — used when the company's plan has no PrivacyPilot. */
        public static Transparency none() {
            return new Transparency(0, null, null, null);
        }
    }
}
