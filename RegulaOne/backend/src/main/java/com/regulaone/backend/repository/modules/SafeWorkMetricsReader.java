package com.regulaone.backend.repository.modules;

import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.AttentionItem;
import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.Metric;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

/**
 * Reads the SafeWork (HR / BHP workplace-safety) numbers for one company.
 *
 * WHAT SafeWork DOES: it tracks the two documents Polish law requires before a
 * person may work — a valid occupational medical certificate and valid health &
 * safety (BHP) training — and blocks clock-in when either is missing or expired.
 *
 * WHY THESE NUMBERS MATTER LEGALLY:
 *   * An employer may not let an employee work without a current medical
 *     certificate (Kodeks pracy art. 229 §4).
 *   * An employer may not let an employee work without the required BHP training
 *     (Kodeks pracy art. 237(3) §1–§2).
 *   So "blocked employees" and "expired documents" are not admin housekeeping —
 *   each one is a person who legally must not be on shift.
 *
 * HOW THE COMPANY FILTER WORKS (important):
 *   SafeWork employee records do NOT carry a tenantId. They link to the shared
 *   RegulaOne user record instead, and the company lives on that user. So this
 *   reader first asks RegulaOne "which user ids belong to this company?" and then
 *   counts only the SafeWork records pointing at those users. That keeps one
 *   company's figures completely separate from another's.
 *
 * PRIVACY NOTE — WHAT IS DELIBERATELY LEFT OUT:
 *   Only counts are read. No names, no PESEL, no dates of birth, no certificate
 *   files, and no medical details. Information about a named person's health is
 *   special-category data (GDPR Art. 9), so it stays inside SafeWork where the
 *   HR role-based checks apply; the dashboard is told only how many people are in
 *   each state.
 */
@Repository
public class SafeWorkMetricsReader extends ModuleMetricsSupport {

    private static final String EMPLOYEES = "safework_employees";
    private static final String USERS = "users";

    private static final String ROUTE = "/modules/safework";

    private static final String LAW_MEDICAL = "Kodeks pracy art. 229 §4 (badania lekarskie)";
    private static final String LAW_BHP = "Kodeks pracy art. 237(3) (szkolenia BHP)";

    public SafeWorkMetricsReader(MongoTemplate mongo) {
        super(mongo);
    }

    public ModuleSnapshot read(String tenantId) {
        List<Metric> metrics = new ArrayList<>();
        List<AttentionItem> attention = new ArrayList<>();

        // Step 1 — which user accounts belong to this company?
        // RegulaOne stores the link as a MongoDB DBRef, so the company id sits in
        // the nested "tenant.$id" field.
        List<ObjectId> userIds = tenantUserIds(tenantId);
        if (userIds.isEmpty()) {
            // No users yet means no SafeWork profiles can exist either. Report
            // honest zeroes rather than leaving the card blank.
            metrics.add(Metric.count("safework.employees.total", 0));
            return new ModuleSnapshot(metrics, attention);
        }

        Date now = now();
        Date soon = daysAhead(EXPIRY_WARNING_DAYS);

        // Step 2 — one aggregation counts every state we care about.
        // "isActive != false" also catches older records where the flag was never
        // written at all (a missing field does not match "isActive: true").
        Document stats = aggregateOne(EMPLOYEES, List.of(
                new Document("$match", new Document("userId", new Document("$in", userIds))
                        .append("isActive", new Document("$ne", false))),
                new Document("$group", new Document("_id", null)
                        .append("total", new Document("$sum", 1))
                        .append("compliant", sumWhen(eq("$complianceStatus", "COMPLIANT")))
                        .append("blocked", sumWhen(eq("$isBlocked", true)))

                        // Expired: the position requires the document AND the
                        // stored expiry date is already in the past. The date is
                        // checked live because the saved status text is only
                        // refreshed on upload and goes stale.
                        .append("medicalExpired", sumWhen(expired(
                                "$requiresMedicalCertificate", "$medicalCertificate.expiryDate", now)))
                        .append("bhpExpired", sumWhen(expired(
                                "$requiresBHPTraining", "$bhpTraining.expiryDate", now)))

                        // Missing: the position requires the document but no
                        // expiry date was ever recorded, i.e. nothing was uploaded.
                        .append("medicalMissing", sumWhen(missing(
                                "$requiresMedicalCertificate", "$medicalCertificate.expiryDate")))
                        .append("bhpMissing", sumWhen(missing(
                                "$requiresBHPTraining", "$bhpTraining.expiryDate")))

                        // Expiring soon: still valid today but runs out inside the
                        // 30-day warning window, for either document.
                        .append("expiringSoon", sumWhen(new Document("$or", List.of(
                                expiring("$medicalCertificate.expiryDate", now, soon),
                                expiring("$bhpTraining.expiryDate", now, soon))))))));

        long total = asLong(stats.get("total"));
        long compliant = asLong(stats.get("compliant"));
        long blocked = asLong(stats.get("blocked"));
        long medicalExpired = asLong(stats.get("medicalExpired"));
        long bhpExpired = asLong(stats.get("bhpExpired"));
        long medicalMissing = asLong(stats.get("medicalMissing"));
        long bhpMissing = asLong(stats.get("bhpMissing"));
        long expiringSoon = asLong(stats.get("expiringSoon"));

        long expiredTotal = medicalExpired + bhpExpired;
        long missingTotal = medicalMissing + bhpMissing;

        metrics.add(Metric.count("safework.employees.total", total));
        metrics.add(Metric.count("safework.employees.compliant", compliant,
                "GOOD", null));
        metrics.add(new Metric("safework.employees.compliantPct",
                Integer.toString(percent(compliant, total)), "PERCENT",
                percent(compliant, total) >= 100 ? "GOOD" : "WARN", null));
        metrics.add(Metric.count("safework.employees.blocked", blocked,
                blocked > 0 ? "RISK" : "GOOD", LAW_MEDICAL));
        metrics.add(Metric.count("safework.documents.medicalExpired", medicalExpired,
                medicalExpired > 0 ? "RISK" : "GOOD", LAW_MEDICAL));
        metrics.add(Metric.count("safework.documents.bhpExpired", bhpExpired,
                bhpExpired > 0 ? "RISK" : "GOOD", LAW_BHP));
        metrics.add(Metric.count("safework.documents.missingRequired", missingTotal,
                missingTotal > 0 ? "RISK" : "GOOD", LAW_BHP));
        metrics.add(Metric.count("safework.documents.expiringSoon", expiringSoon,
                expiringSoon > 0 ? "WARN" : "GOOD", LAW_MEDICAL));

        // ── Attention list ─────────────────────────────────────────────────────
        if (blocked > 0) {
            attention.add(new AttentionItem("SAFEWORK", "SAFEWORK_EMPLOYEE_BLOCKED",
                    (int) blocked, "RISK", LAW_MEDICAL, ROUTE));
        }
        if (expiredTotal > 0) {
            attention.add(new AttentionItem("SAFEWORK", "SAFEWORK_DOCUMENT_EXPIRED",
                    (int) expiredTotal, "RISK", LAW_MEDICAL, ROUTE));
        }
        if (missingTotal > 0) {
            attention.add(new AttentionItem("SAFEWORK", "SAFEWORK_DOCUMENT_MISSING",
                    (int) missingTotal, "RISK", LAW_BHP, ROUTE));
        }
        if (expiringSoon > 0) {
            attention.add(new AttentionItem("SAFEWORK", "SAFEWORK_DOCUMENT_EXPIRING",
                    (int) expiringSoon, "WARN", LAW_MEDICAL, ROUTE));
        }

        return new ModuleSnapshot(metrics, attention);
    }

    /**
     * The MongoDB ids of every user account in this company.
     *
     * Only the "_id" field is projected, so no name, e-mail or other personal
     * detail is read — the ids are used purely to scope the SafeWork count.
     */
    private List<ObjectId> tenantUserIds(String tenantId) {
        List<Document> rows = aggregate(USERS, List.of(
                new Document("$match", new Document("tenant.$id", new ObjectId(tenantId))),
                new Document("$project", new Document("_id", 1))));

        List<ObjectId> ids = new ArrayList<>(rows.size());
        for (Document row : rows) {
            if (row.get("_id") instanceof ObjectId id) ids.add(id);
        }
        return ids;
    }

    // ── Tiny aggregation building blocks ────────────────────────────────────────

    /** "count this document when the condition is true". */
    private static Document sumWhen(Document condition) {
        return new Document("$sum", new Document("$cond", List.of(condition, 1, 0)));
    }

    private static Document eq(String field, Object value) {
        return new Document("$eq", List.of(field, value));
    }

    /**
     * A two-value operand list for an aggregation expression.
     *
     * {@code List.of(...)} cannot be used here: it throws on a null element, and
     * comparing a field TO null ("was a document ever uploaded?") is exactly what
     * these expressions need to do. {@code Arrays.asList} allows the null.
     */
    private static List<Object> operands(Object left, Object right) {
        return java.util.Arrays.asList(left, right);
    }

    /** The position needs this document and its expiry date is already past. */
    private static Document expired(String requiredFlag, String expiryField, Date now) {
        return new Document("$and", List.of(
                eq(requiredFlag, true),
                new Document("$ne", operands(expiryField, null)),
                new Document("$lt", operands(expiryField, now))));
    }

    /** The position needs this document but nothing was ever uploaded for it. */
    private static Document missing(String requiredFlag, String expiryField) {
        return new Document("$and", List.of(
                eq(requiredFlag, true),
                new Document("$eq", operands(expiryField, null))));
    }

    /** Still valid today, but runs out inside the warning window. */
    private static Document expiring(String expiryField, Date now, Date soon) {
        return new Document("$and", List.of(
                new Document("$ne", operands(expiryField, null)),
                new Document("$gt", operands(expiryField, now)),
                new Document("$lte", operands(expiryField, soon))));
    }
}
