package com.regulaone.backend.repository.modules.personal;

import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Unit tests for the rules the personal ("My Workspace") dashboard depends on.
 *
 * These need no database, so they run in the normal build. They pin down the two
 * things that would be dangerous to get wrong:
 *
 *   1. THE OWNER FILTER. Every personal query must be limited to one company AND
 *      one person. A test that a malformed user id can never widen a query is the
 *      difference between "shows nothing" and "shows the whole company".
 *
 *   2. THE EXPIRY ARITHMETIC. Whether a medical certificate reads as VALID,
 *      EXPIRING or EXPIRED decides whether a person is told they may not work
 *      (Kodeks pracy art. 229 §4), so the day boundaries are tested exactly.
 */
class PersonalMetricsSupportTest {

    private static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");

    /** A date the given number of days from today, at Warsaw midnight. */
    private static Date daysFromToday(long days) {
        return Date.from(LocalDate.now(WARSAW).plusDays(days).atStartOfDay(WARSAW).toInstant());
    }

    // ── The owner filter ────────────────────────────────────────────────────────

    @Test
    @DisplayName("a text-owner filter always carries BOTH the company and the person")
    void textOwnerFilterCarriesCompanyAndPerson() {
        Document filter = PersonalMetricsSupport
                .mine("tenant-1", "createdBy", "user-9")
                .getCriteriaObject();

        assertEquals("tenant-1", filter.get("tenantId"), "the company filter is missing");
        assertEquals("user-9", filter.get("createdBy"), "the person filter is missing");
    }

    @Test
    @DisplayName("an ObjectId-owner filter carries the company and the person's id")
    void objectIdOwnerFilterCarriesCompanyAndPerson() {
        String userId = new ObjectId().toHexString();

        Document filter = PersonalMetricsSupport
                .mineByObjectId("tenant-1", "userId", userId)
                .getCriteriaObject();

        assertEquals("tenant-1", filter.get("tenantId"));
        assertEquals(new ObjectId(userId), filter.get("userId"));
    }

    @Test
    @DisplayName("a malformed user id matches NOTHING instead of everyone")
    void malformedUserIdCannotWidenTheQuery() {
        // This is the important one. If a bad id silently dropped the owner filter,
        // an employee would be shown their colleagues' records.
        for (String bad : new String[]{null, "", "not-an-id", "12345"}) {
            Document filter = PersonalMetricsSupport
                    .mineByObjectId("tenant-1", "userId", bad)
                    .getCriteriaObject();

            assertEquals("tenant-1", filter.get("tenantId"));
            assertTrue(filter.containsKey("userId"),
                    "the owner filter disappeared for a malformed id: " + bad);
            assertEquals(new ObjectId("000000000000000000000000"), filter.get("userId"),
                    "a malformed id must match nothing, not everything");
        }
    }

    @Test
    @DisplayName("only a real MongoDB id is accepted as an id")
    void onlyValidIdsAreParsed() {
        assertNull(PersonalMetricsSupport.objectId(null));
        assertNull(PersonalMetricsSupport.objectId("nope"));

        String valid = new ObjectId().toHexString();
        assertEquals(new ObjectId(valid), PersonalMetricsSupport.objectId(valid));
    }

    // ── Days remaining ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("days remaining is counted in whole calendar days")
    void daysRemainingIsCountedInWholeDays() {
        assertNull(PersonalMetricsSupport.daysUntil(null), "no date means no number");
        assertEquals(0, PersonalMetricsSupport.daysUntil(daysFromToday(0)),
                "a document that expires today must read as 0, not as a fraction");
        assertEquals(30, PersonalMetricsSupport.daysUntil(daysFromToday(30)));
        assertEquals(-1, PersonalMetricsSupport.daysUntil(daysFromToday(-1)),
                "an expired document must read as a negative number of days");
    }

    // ── Document status ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("a document the job does not need is NOT_REQUIRED, whatever its date")
    void documentNotRequired() {
        assertEquals("NOT_REQUIRED", PersonalMetricsSupport.documentStatus(false, null));
        assertEquals("NOT_REQUIRED", PersonalMetricsSupport.documentStatus(false, daysFromToday(-5)));
    }

    @Test
    @DisplayName("required but never uploaded is MISSING")
    void documentMissing() {
        assertEquals("MISSING", PersonalMetricsSupport.documentStatus(true, null));
    }

    @Test
    @DisplayName("a past date is EXPIRED — the person may not legally work")
    void documentExpired() {
        assertEquals("EXPIRED", PersonalMetricsSupport.documentStatus(true, daysFromToday(-1)));
    }

    @Test
    @DisplayName("the 30-day warning window is inclusive at both ends")
    void documentExpiringWindowBoundaries() {
        // Expiring today still counts as EXPIRING rather than EXPIRED: the document
        // is valid for the whole of its last day.
        assertEquals("EXPIRING", PersonalMetricsSupport.documentStatus(true, daysFromToday(0)));
        assertEquals("EXPIRING", PersonalMetricsSupport.documentStatus(true, daysFromToday(30)));
        // One day past the window is simply valid — no warning yet.
        assertEquals("VALID", PersonalMetricsSupport.documentStatus(true, daysFromToday(31)));
    }

    // ── Formatting ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("an expiry date is reported as plain YYYY-MM-DD, or nothing at all")
    void expiryDateIsPlainIsoText() {
        assertNull(PersonalMetricsSupport.isoDay(null));

        LocalDate day = LocalDate.now(WARSAW).plusDays(7);
        assertEquals(day.toString(), PersonalMetricsSupport.isoDay(daysFromToday(7)));
    }

    @Test
    @DisplayName("a nested field is read safely even when the parent is absent")
    void nestedReadsAreSafe() {
        Document profile = new Document("medicalCertificate",
                new Document("expiryDate", daysFromToday(10)));

        assertEquals(daysFromToday(10),
                PersonalMetricsSupport.nested(profile, "medicalCertificate", "expiryDate"));

        // A missing parent, a missing child and a missing document must all be quiet
        // nulls: a profile saved before a field existed must not break the page.
        assertNull(PersonalMetricsSupport.nested(profile, "bhpTraining", "expiryDate"));
        assertNull(PersonalMetricsSupport.nested(profile, "medicalCertificate", "nope"));
        assertNull(PersonalMetricsSupport.nested(null, "medicalCertificate", "expiryDate"));
    }
}
