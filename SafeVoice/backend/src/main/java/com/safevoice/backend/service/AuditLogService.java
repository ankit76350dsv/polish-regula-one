package com.safevoice.backend.service;

import com.safevoice.backend.dto.PageResponse;
import com.safevoice.backend.model.document.AuditLog;
import com.safevoice.backend.model.enums.audit.AuditActionType;
import com.safevoice.backend.model.enums.audit.AuditOutcome;
import com.safevoice.backend.repository.AuditLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Service representing compliance-grade tamper-evident audit logging.
 * Calculates cryptographic SHA-256 hash chains connecting log events within a tenant.
 */
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

        Instant timestamp = Instant.now();
        
        // Find latest audit log for this tenant to retrieve the previous hash link
        AuditLog previousLog = auditLogRepository.findFirstByTenantIdOrderByTimestampDesc(tenantId);
        String previousHash = (previousLog != null) ? previousLog.getHashChain() : "0000000000000000000000000000000000000000000000000000000000000000";

        // Construct string to hash
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
                previousHash
        );

        String hashChain = calculateSha256(dataToHash);

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
