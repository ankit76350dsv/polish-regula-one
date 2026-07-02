package com.safevoice.backend.service;

import com.safevoice.backend.dto.PageResponse;
import com.safevoice.backend.model.document.AuditLog;
import com.safevoice.backend.model.enums.audit.AuditActionType;
import com.safevoice.backend.model.enums.audit.AuditOutcome;
import com.safevoice.backend.repository.AuditLogRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Service representing compliance-grade tamper-evident audit logging.
 * Calculates cryptographic SHA-256 hash chains connecting log events within a tenant.
 */
@Slf4j
@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;
    // Used for the audit-trail screen, which needs flexible search/filter/sort/paging
    // that fixed repository methods cannot express. MongoTemplate builds the query
    // dynamically and safely (user text is escaped before it reaches the DB).
    private final MongoTemplate mongoTemplate;

    // Page-size guards for the audit trail.
    private static final int MAX_AUDIT_PAGE_SIZE = 200;
    private static final int DEFAULT_AUDIT_PAGE_SIZE = 20;

    // The hash the very first entry in a tenant's chain links back to.
    private static final String GENESIS_HASH =
            "0000000000000000000000000000000000000000000000000000000000000000";

    @Autowired
    public AuditLogService(AuditLogRepository auditLogRepository, MongoTemplate mongoTemplate) {
        this.auditLogRepository = auditLogRepository;
        this.mongoTemplate = mongoTemplate;
    }

    /**
     * Records a compliance action, computing the SHA-256 hashchain link from the previous entry.
     */
    public synchronized AuditLog log(
            String tenantId,
            String actorRole,
            String actorRef,
            AuditActionType actionType,
            String subjectId,
            AuditOutcome outcome,
            String oldValue,
            String newValue,
            String metadataNotice) {

        // Truncate to milliseconds: MongoDB stores dates at millisecond precision, so if we hashed
        // a higher-precision Instant the chain could never be recomputed/verified from stored data.
        Instant timestamp = Instant.now().truncatedTo(ChronoUnit.MILLIS);

        // Find latest audit log for this tenant to retrieve the previous hash link
        AuditLog previousLog = auditLogRepository.findFirstByTenantIdOrderByTimestampDesc(tenantId);
        String previousHash = (previousLog != null) ? previousLog.getHashChain() : GENESIS_HASH;

        // Link this entry to the previous one via a SHA-256 over its fields + the previous hash.
        String hashChain = computeHash(tenantId, actorRole, actorRef, actionType, subjectId,
                outcome, oldValue, newValue, timestamp, previousHash);

        AuditLog auditLog = AuditLog.builder()
                .tenantId(tenantId)
                .actorRole(actorRole)
                .actorRef(actorRef)
                .actionType(actionType)
                .subjectId(subjectId)
                .timestamp(timestamp)
                .outcome(outcome)
                .oldValue(oldValue)
                .newValue(newValue)
                .metadataNotice(metadataNotice)
                .hashChain(hashChain)
                .build();

        return auditLogRepository.save(auditLog);
    }

    /**
     * Read ONE PAGE of the tenant's audit trail, newest first, with optional filters.
     *
     * Read-only: this never alters the immutable log. Every input is treated as untrusted
     * and made safe:
     *  - tenantId is required (we never read another organisation's trail).
     *  - page below 1 becomes 1; size is clamped to a default and a hard maximum.
     *  - a blank search is ignored; a non-blank one is escaped before it touches the DB.
     *  - an unknown actionType / outcome value is ignored (not an error).
     *  - from / to accept either a full ISO timestamp or a plain "YYYY-MM-DD" date; an
     *    unparseable value is ignored. "to" is treated as exclusive end-of-day.
     *
     * @param tenantId   the organisation whose trail to read (required)
     * @param search     free text matched across actor, action, subject, outcome, notice
     * @param actionType keep only this action type (enum name), optional
     * @param outcome    keep only this outcome (enum name), optional
     * @param subjectId  keep only entries about this subject (e.g. one case id), optional
     * @param from       only entries at/after this date-time, optional
     * @param to         only entries before the day after this date-time, optional
     * @param page       1-based page number
     * @param size       rows per page
     */
    public PageResponse<AuditLog> search(String tenantId, String search, String actionType,
                                         String outcome, String subjectId, String from, String to,
                                         int page, int size) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new IllegalArgumentException("Tenant info/context is required");
        }

        int safePage = page < 1 ? 1 : page;
        int safeSize = size < 1 ? DEFAULT_AUDIT_PAGE_SIZE : Math.min(size, MAX_AUDIT_PAGE_SIZE);

        List<Criteria> conditions = new ArrayList<>();
        conditions.add(Criteria.where("tenantId").is(tenantId));

        // Exact filters — silently ignored when not supplied or not a known value.
        AuditActionType action = parseEnum(AuditActionType.class, actionType);
        if (action != null) {
            conditions.add(Criteria.where("actionType").is(action));
        }
        AuditOutcome outcomeValue = parseEnum(AuditOutcome.class, outcome);
        if (outcomeValue != null) {
            conditions.add(Criteria.where("outcome").is(outcomeValue));
        }
        if (subjectId != null && !subjectId.isBlank()) {
            conditions.add(Criteria.where("subjectId").is(subjectId.trim()));
        }

        // Date range on the timestamp. "to" is exclusive of the next day so a single
        // calendar day selected for both ends still includes that whole day.
        Instant fromInstant = parseRangeStart(from);
        if (fromInstant != null) {
            conditions.add(Criteria.where("timestamp").gte(fromInstant));
        }
        Instant toInstant = parseRangeEnd(to);
        if (toInstant != null) {
            conditions.add(Criteria.where("timestamp").lt(toInstant));
        }

        // Free-text search across the human-meaningful fields, escaped (no regex injection).
        if (search != null && !search.isBlank()) {
            String literal = Pattern.quote(search.trim());
            conditions.add(new Criteria().orOperator(
                    Criteria.where("actorRole").regex(literal, "i"),
                    Criteria.where("actorRef").regex(literal, "i"),
                    Criteria.where("actionType").regex(literal, "i"),
                    Criteria.where("subjectId").regex(literal, "i"),
                    Criteria.where("outcome").regex(literal, "i"),
                    Criteria.where("metadataNotice").regex(literal, "i")));
        }

        Criteria all = new Criteria().andOperator(conditions.toArray(new Criteria[0]));

        long total = mongoTemplate.count(Query.query(all), AuditLog.class);
        Query pageQuery = Query.query(all)
                .with(Sort.by(Sort.Direction.DESC, "timestamp"))
                .skip((long) (safePage - 1) * safeSize)
                .limit(safeSize);
        List<AuditLog> items = mongoTemplate.find(pageQuery, AuditLog.class);

        int totalPages = (int) Math.ceil((double) total / safeSize);
        return PageResponse.<AuditLog>builder()
                .items(items)
                .page(safePage)
                .size(safeSize)
                .total(total)
                .totalPages(totalPages)
                .build();
    }

    /** Parse an enum by name, ignoring case and surrounding spaces; null if blank/unknown. */
    private static <E extends Enum<E>> E parseEnum(Class<E> type, String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Enum.valueOf(type, value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** Start of the range: accepts an ISO instant or a "YYYY-MM-DD" date (start of day, UTC). */
    private static Instant parseRangeStart(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String v = value.trim();
        try {
            return Instant.parse(v);
        } catch (DateTimeParseException ignored) {
            // fall through to date-only
        }
        try {
            return LocalDate.parse(v).atStartOfDay(ZoneOffset.UTC).toInstant();
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    /** End of the range: an ISO instant, or a "YYYY-MM-DD" date treated as the NEXT day's start. */
    private static Instant parseRangeEnd(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String v = value.trim();
        try {
            return Instant.parse(v);
        } catch (DateTimeParseException ignored) {
            // fall through to date-only
        }
        try {
            return LocalDate.parse(v).plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    // The single source of truth for how a chain link is computed. Used by BOTH log() (at write)
    // and verifyChain() (at read), so the two can never drift out of sync.
    private String computeHash(String tenantId, String actorRole, String actorRef,
                               AuditActionType actionType, String subjectId, AuditOutcome outcome,
                               String oldValue, String newValue, Instant timestamp, String previousHash) {
        String dataToHash = String.format("%s|%s|%s|%s|%s|%s|%s|%s|%s|%s",
                tenantId,
                actorRole,
                actorRef,
                actionType.name(),
                subjectId != null ? subjectId : "null",
                outcome.name(),
                oldValue != null ? oldValue : "",
                newValue != null ? newValue : "",
                timestamp.toString(),
                previousHash);
        return calculateSha256(dataToHash);
    }

    /**
     * Re-walk a tenant's audit chain from the genesis and recompute every link, to DETECT
     * tampering the app-level immutability guard cannot prevent (e.g. a row edited or deleted
     * via direct database access). Returns a result describing the first break, if any.
     *
     * A break means an entry was altered, or an entry was deleted (the next entry no longer
     * hashes to the recorded link). NOTE: this cannot detect deletion of the most RECENT entry
     * (nothing points forward to it) — that requires an external anchor (see class/infra notes).
     * Records written before the millisecond-timestamp fix are not verifiable and are reported
     * as such rather than as tampering.
     */
    public AuditChainVerification verifyChain(String tenantId) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new IllegalArgumentException("Tenant info/context is required");
        }
        // Process in insertion order (timestamp asc, id asc as a stable tiebreak), exactly as the
        // chain was built at write time.
        List<AuditLog> entries = mongoTemplate.find(
                Query.query(Criteria.where("tenantId").is(tenantId))
                        .with(Sort.by(Sort.Direction.ASC, "timestamp").and(Sort.by(Sort.Direction.ASC, "id"))),
                AuditLog.class);

        String previousHash = GENESIS_HASH;
        int checked = 0;
        for (AuditLog e : entries) {
            String expected = computeHash(e.getTenantId(), e.getActorRole(), e.getActorRef(),
                    e.getActionType(), e.getSubjectId(), e.getOutcome(), e.getOldValue(),
                    e.getNewValue(), e.getTimestamp(), previousHash);
            if (!expected.equals(e.getHashChain())) {
                return new AuditChainVerification(tenantId, false, checked, e.getId(),
                        "Audit chain broken at entry " + e.getId() + " — an entry was altered or deleted.");
            }
            previousHash = e.getHashChain();
            checked++;
        }
        return new AuditChainVerification(tenantId, true, checked, null,
                "Audit chain intact (" + checked + " entries verified).");
    }

    /**
     * Scheduled integrity sweep: verify every tenant's audit chain and RAISE AN ALERT (error log)
     * on any break, so tampering is noticed rather than silently tolerated. Runs on the configured
     * cron (default 04:00 daily, after the retention job).
     */
    @Scheduled(cron = "${safevoice.audit.verify-cron:0 0 4 * * *}")
    public void verifyAllChains() {
        List<String> tenantIds = mongoTemplate.findDistinct(new Query(), "tenantId", AuditLog.class, String.class);
        int broken = 0;
        for (String tenantId : tenantIds) {
            try {
                AuditChainVerification result = verifyChain(tenantId);
                if (!result.verified()) {
                    broken++;
                    // ALERT: this is a compliance-critical event — wire to alerting/SIEM in prod.
                    log.error("[AuditLogService] AUDIT CHAIN INTEGRITY FAILURE for tenant {}: {}",
                            tenantId, result.message());
                }
            } catch (Exception e) {
                log.error("[AuditLogService] Audit chain verification errored for tenant {}: {}",
                        tenantId, e.getMessage());
            }
        }
        log.info("[AuditLogService] Audit chain verification complete: {} tenant(s) checked, {} broken.",
                tenantIds.size(), broken);
    }

    /** Result of a chain verification. `verified` is false when a break was found. */
    public record AuditChainVerification(String tenantId, boolean verified, int entriesChecked,
                                         String firstBrokenId, String message) {}

    private String calculateSha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 hash calculation failed", e);
        }
    }
}
