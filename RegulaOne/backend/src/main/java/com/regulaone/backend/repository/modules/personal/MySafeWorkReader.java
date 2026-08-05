package com.regulaone.backend.repository.modules.personal;

import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.AttentionItem;
import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.Metric;
import com.regulaone.backend.dto.Dashboard.MyOverviewResponse.MyDocument;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

/**
 * Reads ONE PERSON'S own health-and-safety paperwork out of SafeWork.
 *
 * WHY THIS IS THE MOST USEFUL CARD ON AN EMPLOYEE'S DASHBOARD:
 *   Polish law forbids an employer from letting somebody work without a current
 *   occupational medical certificate (Kodeks pracy art. 229 §4) or without the
 *   required health-and-safety (BHP) training (art. 237(3) §1–§2). SafeWork
 *   enforces that by BLOCKING clock-in. So an employee whose certificate quietly
 *   expired cannot work — and the only fair thing is to warn them well before the
 *   date, with the date itself.
 *
 * HOW THE PERSON IS FOUND:
 *   SafeWork employee records carry no tenantId; they point at the shared RegulaOne
 *   user record with "userId". Since the caller's own user id is what we look up,
 *   the record found can only ever be their own — there is nothing to leak.
 *
 * WHAT IS DELIBERATELY NOT READ:
 *   The medical certificate FILE, the PESEL, the date of birth and the block reason
 *   text are never read. Only the two validity dates, the "required" flags and the
 *   status word SafeWork keeps. Health information is special-category data
 *   (GDPR Art. 9), so even on the person's own dashboard we stay at "valid until
 *   this date" and nothing more.
 */
@Repository
public class MySafeWorkReader extends PersonalMetricsSupport {

    private static final String EMPLOYEES = "safework_employees";

    private static final String ROUTE = "/modules/safework";

    private static final String LAW_MEDICAL = "Kodeks pracy art. 229 §4 (badania lekarskie)";
    private static final String LAW_BHP = "Kodeks pracy art. 237(3) (szkolenia BHP)";

    public MySafeWorkReader(MongoTemplate mongo) {
        super(mongo);
    }

    /**
     * @param userId the caller's own RegulaOne user id — the profile is looked up BY
     *               that id, so this reader cannot return anybody else's documents
     */
    public PersonalSnapshot read(String userId) {
        ObjectId id = objectId(userId);
        if (id == null) return PersonalSnapshot.empty();

        // Only the fields needed are listed, so no PESEL, no date of birth and no
        // document path is ever transferred out of the database.
        Query query = Query.query(Criteria.where("userId").is(id).and("isActive").ne(false));
        query.fields()
                .include("complianceStatus").include("isBlocked")
                .include("requiresMedicalCertificate").include("requiresBHPTraining")
                .include("medicalCertificate.expiryDate")
                .include("bhpTraining.expiryDate");

        Document profile = mongo.findOne(query, Document.class, EMPLOYEES);

        List<Metric> metrics = new ArrayList<>();
        List<AttentionItem> attention = new ArrayList<>();

        // No profile yet. HR creates it, so the honest answer is "your profile is
        // not set up" — not a reassuring row of zeroes.
        if (profile == null) {
            metrics.add(new Metric("my.safework.profile.status", "NO_PROFILE", "TEXT",
                    "WARN", LAW_MEDICAL));
            attention.add(new AttentionItem("SAFEWORK", "MY_SAFEWORK_PROFILE_MISSING",
                    1, "WARN", LAW_MEDICAL, ROUTE));
            return PersonalSnapshot.of(metrics, attention);
        }

        boolean medicalRequired = Boolean.TRUE.equals(profile.get("requiresMedicalCertificate"));
        boolean bhpRequired = Boolean.TRUE.equals(profile.get("requiresBHPTraining"));

        Date medicalExpiry = date(nested(profile, "medicalCertificate", "expiryDate"));
        Date bhpExpiry = date(nested(profile, "bhpTraining", "expiryDate"));

        String medicalState = documentStatus(medicalRequired, medicalExpiry);
        String bhpState = documentStatus(bhpRequired, bhpExpiry);

        boolean blocked = Boolean.TRUE.equals(profile.get("isBlocked"));
        String complianceStatus = profile.get("complianceStatus") == null
                ? "NON_COMPLIANT"
                : String.valueOf(profile.get("complianceStatus"));

        // ── The document list the screen lays out with dates ────────────────────
        List<MyDocument> documents = List.of(
                new MyDocument("MEDICAL_CERTIFICATE", medicalState, isoDay(medicalExpiry),
                        daysUntil(medicalExpiry), medicalRequired, LAW_MEDICAL),
                new MyDocument("BHP_TRAINING", bhpState, isoDay(bhpExpiry),
                        daysUntil(bhpExpiry), bhpRequired, LAW_BHP));

        // ── The card figures ───────────────────────────────────────────────────
        metrics.add(new Metric("my.safework.profile.status", complianceStatus, "TEXT",
                switch (complianceStatus) {
                    case "COMPLIANT" -> "GOOD";
                    case "EXPIRING" -> "WARN";
                    default -> "RISK";
                }, LAW_MEDICAL));

        // "Am I allowed to work today?" is the single most important line here.
        metrics.add(new Metric("my.safework.blocked", blocked ? "1" : "0", "COUNT",
                blocked ? "RISK" : "GOOD", LAW_MEDICAL));

        if (medicalRequired) {
            metrics.add(new Metric("my.safework.medical.expiry",
                    isoDay(medicalExpiry) == null ? "" : isoDay(medicalExpiry),
                    "DATE", tone(medicalState), LAW_MEDICAL));
        }
        if (bhpRequired) {
            metrics.add(new Metric("my.safework.bhp.expiry",
                    isoDay(bhpExpiry) == null ? "" : isoDay(bhpExpiry),
                    "DATE", tone(bhpState), LAW_BHP));
        }

        // ── The person's to-do list ────────────────────────────────────────────
        // Blocked comes first: it means they may not legally be on shift today.
        if (blocked) {
            attention.add(new AttentionItem("SAFEWORK", "MY_SAFEWORK_BLOCKED",
                    1, "RISK", LAW_MEDICAL, ROUTE));
        }
        addDocumentAttention(attention, medicalState, "MEDICAL", LAW_MEDICAL);
        addDocumentAttention(attention, bhpState, "BHP", LAW_BHP);

        return new PersonalSnapshot(metrics, attention, documents);
    }

    /**
     * One document turns into at most one to-do item.
     *
     * EXPIRED and MISSING are both RISK, because in either case the law does not
     * allow the person to work; EXPIRING is a WARN, which is the whole point of the
     * 30-day window — there is still time to book an appointment.
     */
    private void addDocumentAttention(List<AttentionItem> attention,
                                      String state, String kind, String legalRef) {
        switch (state) {
            case "EXPIRED" -> attention.add(new AttentionItem("SAFEWORK",
                    "MY_SAFEWORK_" + kind + "_EXPIRED", 1, "RISK", legalRef, ROUTE));
            case "MISSING" -> attention.add(new AttentionItem("SAFEWORK",
                    "MY_SAFEWORK_" + kind + "_MISSING", 1, "RISK", legalRef, ROUTE));
            case "EXPIRING" -> attention.add(new AttentionItem("SAFEWORK",
                    "MY_SAFEWORK_" + kind + "_EXPIRING", 1, "WARN", legalRef, ROUTE));
            default -> { /* VALID or NOT_REQUIRED — nothing to do */ }
        }
    }

    /** The colour a document state gets on the card. */
    private static String tone(String state) {
        return switch (state) {
            case "VALID" -> "GOOD";
            case "EXPIRING" -> "WARN";
            case "NOT_REQUIRED" -> "NEUTRAL";
            default -> "RISK";
        };
    }
}
