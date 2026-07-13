package com.safevoice.backend.repository;

import com.safevoice.backend.model.document.CaseReport;
import com.safevoice.backend.model.enums.case_report.CaseStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * MongoDB repository for managing CaseReport documents.
 */
@Repository
public interface CaseReportRepository extends MongoRepository<CaseReport, String> {

    /**
     * Finds a case report by the SHA-256 fingerprint of its access key.
     * This is how the anonymous reporter flow looks a case up: we hash the key the
     * reporter types and match it against this stored fingerprint. The key fingerprint
     * is globally unique, so no tenant context is needed (and the reporter has none).
     */
    Optional<CaseReport> findByKeyHash(String keyHash);

    /**
     * Lists all non-soft-deleted case reports for a tenant.
     */
    List<CaseReport> findAllByTenantIdAndDeletedFalse(String tenantId);

    /**
     * Tells us whether a tenant already has a case with this readable reference.
     * The reference is built from the submission minute (e.g. "SV/2026/0629/1408"), so
     * two reports filed in the same minute would clash; we use this to detect that and
     * ask the second reporter to try again a minute later. Scoped to the tenant, because
     * each organisation has its own independent set of references.
     */
    boolean existsByTenantIdAndCaseReference(String tenantId, String caseReference);

    // ── Dashboard counters ───────────────────────────────────────────────────────

    /** Total active (non-deleted) cases for a tenant. */
    long countByTenantIdAndDeletedFalse(String tenantId);

    /** Active cases NOT in the given status — used to count "open" cases (status != CLOSED). */
    long countByTenantIdAndDeletedFalseAndStatusNot(String tenantId, CaseStatus status);

    /**
     * Active cases that are still open (status != CLOSED) whose feedback deadline has
     * already passed (before the given time) — i.e. cases that have BREACHED their SLA.
     */
    long countByTenantIdAndDeletedFalseAndStatusNotAndFeedbackDueBefore(
            String tenantId, CaseStatus status, Instant time);

    // ── Retention ────────────────────────────────────────────────────────────────

    /**
     * Cases whose retention period has expired and that are eligible for destruction:
     * not already deleted, `retention.deleteAfter` is at/before now, and the retention state
     * is ACTIVE or DELETION_SCHEDULED. Cases on LEGAL_HOLD (or already DESTROYED) are excluded,
     * so a legal hold always suspends automatic deletion. Cases with no deleteAfter set (legacy,
     * pre-retention-fix) are not matched and need a one-off backfill.
     */
    @Query("{ 'deleted': false, 'retention.deleteAfter': { $lte: ?0 }, "
            + "'retention.state': { $in: ['ACTIVE', 'DELETION_SCHEDULED'] } }")
    List<CaseReport> findDueForDeletion(Instant now);

    // ── Compliance deadlines (7-day acknowledgement, 3-month feedback) ────────────

    /**
     * Active cases still awaiting the automatic reporter acknowledgement (status RECEIVED means
     * no one has acknowledged/triaged them yet). The compliance job acknowledges these promptly,
     * well within the 7-day legal deadline.
     */
    List<CaseReport> findByStatusAndDeletedFalse(CaseStatus status);

    /**
     * Open cases (not closed, not deleted) that are AT or PAST the given feedback-deadline
     * threshold and have not yet been escalated. `$ne: true` matches both false and legacy docs
     * where the field is missing, so old cases are covered too.
     */
    @Query("{ 'deleted': false, 'feedbackEscalated': { $ne: true }, "
            + "'status': { $ne: 'CLOSED' }, 'feedbackDue': { $lte: ?0 } }")
    List<CaseReport> findFeedbackDeadlineDue(Instant threshold);
}
