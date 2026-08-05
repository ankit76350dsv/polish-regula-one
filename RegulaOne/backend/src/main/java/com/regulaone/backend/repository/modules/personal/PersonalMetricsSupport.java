package com.regulaone.backend.repository.modules.personal;

import com.regulaone.backend.repository.modules.ModuleMetricsSupport;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Date;

/**
 * Shared read-only helpers for the SIX personal ("my workspace") module readers.
 *
 * It builds on {@link ModuleMetricsSupport}, so every query helper the company
 * dashboard uses — tenant filtering, counting, aggregating, the calendar-day
 * traps, the hours/kilogram formatting — is reused here rather than written twice.
 *
 * ── THE ONE EXTRA RULE THESE READERS MUST FOLLOW ────────────────────────────────
 *
 * The company dashboard filters every query by COMPANY. A personal dashboard must
 * filter by COMPANY *and* by THE PERSON. Missing the second filter would quietly
 * show an employee their colleagues' records, which is exactly the failure this
 * class exists to prevent — so every personal query starts from {@link #mine} or
 * {@link #mineByObjectId} instead of building its own filter.
 *
 * HOW A PERSON IS IDENTIFIED IN EACH MODULE (all six point at the same RegulaOne
 * user id, but they store it in different field names and two different types):
 *
 *   WorkPulse     workplus_*            userId              (ObjectId)
 *   SafeWork      safework_employees    userId              (ObjectId)
 *   KSeFFlow      ksef_invoices         createdByUserId     (text)
 *   WasteSync     wastesync_*           createdBy           (text)
 *   PrivacyPilot  privacypilot_*        createdBy           (text)
 *   SafeVoice     safevoice_case_reports assignedInvestigator (text — the handler)
 *
 * The differences are declared here once so a reader cannot get one wrong.
 */
public abstract class PersonalMetricsSupport extends ModuleMetricsSupport {

    /**
     * A person whose statutory document runs out inside this many days is warned.
     * Same 30-day window the company dashboard uses, so the two never disagree.
     */
    protected static final int DOCUMENT_WARNING_DAYS = EXPIRY_WARNING_DAYS;

    protected PersonalMetricsSupport(MongoTemplate mongo) {
        super(mongo);
    }

    // ── The mandatory "company AND me" filter ───────────────────────────────────

    /**
     * The starting filter for every personal query in a module that stores the user
     * id as plain text.
     *
     * @param tenantId   the company, taken from the verified session (never the URL)
     * @param ownerField the field that names the owner in this module's collection
     * @param userId     the RegulaOne user id of the person asking
     */
    protected static Criteria mine(String tenantId, String ownerField, String userId) {
        return tenant(tenantId).and(ownerField).is(userId);
    }

    /**
     * The same filter for the two Node modules (WorkPulse, SafeWork), which store
     * the user id as a real MongoDB ObjectId rather than text.
     *
     * A malformed id becomes an impossible filter rather than an exception, so a
     * bad value can never accidentally widen a query to "everyone".
     */
    protected static Criteria mineByObjectId(String tenantId, String ownerField, String userId) {
        ObjectId id = objectId(userId);
        if (id == null) return tenant(tenantId).and(ownerField).is(NO_SUCH_ID);
        return tenant(tenantId).and(ownerField).is(id);
    }

    /**
     * A value nothing can match, used when a user id cannot be parsed. Chosen as a
     * fixed all-zero ObjectId because "match nothing" is the safe direction: the
     * screen shows no figures instead of somebody else's.
     */
    protected static final ObjectId NO_SUCH_ID = new ObjectId("000000000000000000000000");

    /** A MongoDB ObjectId from text, or null when the text is not a valid id. */
    protected static ObjectId objectId(String value) {
        if (value == null || !ObjectId.isValid(value)) return null;
        return new ObjectId(value);
    }

    // ── Document expiry arithmetic (done on the server, once) ────────────────────

    /**
     * Whole days from today until a stored expiry date, on the company's own
     * calendar (Warsaw). Negative when the date has already passed, 0 on the day
     * itself. Null when there is no date at all.
     *
     * Counted in whole CALENDAR days on purpose: "expires today" must read as 0
     * rather than as a confusing fraction of a day.
     */
    protected static Integer daysUntil(Date expiry) {
        if (expiry == null) return null;
        LocalDate day = expiry.toInstant().atZone(WARSAW).toLocalDate();
        return (int) ChronoUnit.DAYS.between(LocalDate.now(WARSAW), day);
    }

    /**
     * Turn one stored document into the word the screen shows.
     *
     * NOT_REQUIRED — this position does not need the document at all.
     * MISSING      — it is required but nothing was ever uploaded.
     * EXPIRED      — the date has passed. In law the person must not work now.
     * EXPIRING     — still valid, but runs out inside the warning window.
     * VALID        — in order.
     *
     * The DATE is what decides, not the status word saved next to it: SafeWork
     * refreshes that word when a document is uploaded, so it goes stale as time
     * passes. Reading the date live means an expiry can never be missed because a
     * nightly job did not run.
     */
    protected static String documentStatus(boolean required, Date expiry) {
        if (!required) return "NOT_REQUIRED";
        Integer days = daysUntil(expiry);
        if (days == null) return "MISSING";
        if (days < 0) return "EXPIRED";
        if (days <= DOCUMENT_WARNING_DAYS) return "EXPIRING";
        return "VALID";
    }

    /** An expiry date as plain "YYYY-MM-DD" text for the API, or null. */
    protected static String isoDay(Date expiry) {
        if (expiry == null) return null;
        return expiry.toInstant().atZone(WARSAW).toLocalDate().toString();
    }

    /** Read a BSON date out of a raw document, whatever it was written as. */
    protected static Date date(Object value) {
        return value instanceof Date d ? d : null;
    }

    /** Read a nested value like "medicalCertificate.expiryDate" out of a document. */
    protected static Object nested(org.bson.Document document, String parent, String child) {
        if (document == null) return null;
        Object holder = document.get(parent);
        return holder instanceof org.bson.Document inner ? inner.get(child) : null;
    }
}
