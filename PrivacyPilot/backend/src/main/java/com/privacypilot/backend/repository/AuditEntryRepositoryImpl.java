package com.privacypilot.backend.repository;

import com.privacypilot.backend.model.document.AuditEntry;
import com.privacypilot.backend.model.enums.audit.AuditAction;
import com.privacypilot.backend.model.enums.audit.AuditEntityType;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.support.PageableExecutionUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Builds the audit-trail search as ONE database query.
 *
 * Spring Data finds this class by name ({@code AuditEntryRepository} + {@code Impl}) and
 * uses it for the methods declared in {@link AuditEntryRepositoryCustom}.
 *
 * The three things that make this safe at ten-year scale:
 *   1. EVERY filter goes into the query, so the database — not Java — decides which rows
 *      match. Nothing unnecessary is ever loaded.
 *   2. The newest-first order is part of the query, so MongoDB can read a matching index in
 *      order instead of collecting everything and sorting it in memory (which it refuses to
 *      do beyond 32 MB).
 *   3. The row limit is part of the query, so the database stops as soon as it has enough.
 *      Memory use is bounded by the limit, not by the size of the trail.
 *
 * The indexes these queries rely on are declared on {@link AuditEntry} and actually created
 * at start-up by MongoIndexConfig — annotations alone do NOT create indexes in this Spring
 * Boot version.
 */
@RequiredArgsConstructor
public class AuditEntryRepositoryImpl implements AuditEntryRepositoryCustom {

    private final MongoTemplate mongoTemplate;

    // The trail is ALWAYS read newest-first. This is fixed here on purpose rather than taken
    // from the caller: it is the order the indexes are built for, so a caller cannot ask for
    // a different sort and quietly trigger the in-memory sort this class exists to avoid.
    private static final Sort NEWEST_FIRST = Sort.by(Sort.Direction.DESC, "createdAt");

    @Override
    public Page<AuditEntry> search(String tenantId, AuditEntityType entityType, String entityId,
                                   AuditAction action, String text, Instant from, Instant to,
                                   Pageable pageable) {
        if (pageable == null || pageable.isUnpaged() || pageable.getPageSize() <= 0) {
            // "Give me everything" is the very thing this class exists to prevent.
            throw new IllegalArgumentException("An audit search must ask for a bounded page");
        }

        // ONE place that says which rows match, used for BOTH the page and the count, so the
        // two can never disagree about what they are counting.
        Query pageQuery = matching(tenantId, entityType, entityId, action, text, from, to)
                .with(NEWEST_FIRST)
                .skip(pageable.getOffset())
                .limit(pageable.getPageSize());

        List<AuditEntry> rows = mongoTemplate.find(pageQuery, AuditEntry.class);

        // The total row count. PageableExecutionUtils SKIPS this second query whenever the
        // answer is already obvious — for example a first page that came back not full IS the
        // whole result — so the common case still costs a single round trip. When it does run,
        // it uses a FRESH copy of the same filters with no skip/limit, which is what makes it
        // a total rather than a page.
        return PageableExecutionUtils.getPage(rows, pageable, () -> mongoTemplate.count(
                matching(tenantId, entityType, entityId, action, text, from, to),
                AuditEntry.class));
    }

    /**
     * Build the "which rows match" part of the query — no ordering, no paging. Kept separate
     * so the page query and the count query are guaranteed to filter identically.
     */
    private Query matching(String tenantId, AuditEntityType entityType, String entityId,
                           AuditAction action, String text, Instant from, Instant to) {
        // Start from the company. This must always be present — it is the tenant boundary.
        Criteria criteria = Criteria.where("tenantId").is(tenantId);

        // Audit lines are never soft-deleted (the immutability listener blocks any update),
        // so this is belt-and-braces; it is kept because every other read in the app filters
        // the same way, and it is part of the index so it costs nothing.
        criteria.and("deleted").is(false);

        // Narrow to one record's history, or to one kind of record.
        if (entityId != null && !entityId.isBlank()) {
            criteria.and("entityId").is(entityId);
        } else if (entityType != null) {
            criteria.and("entityType").is(entityType);
        }
        if (action != null) {
            criteria.and("action").is(action);
        }

        // Date range on the entry's own write time, which IS the time of the action.
        if (from != null && to != null) {
            criteria.and("createdAt").gte(from).lte(to);
        } else if (from != null) {
            criteria.and("createdAt").gte(from);
        } else if (to != null) {
            criteria.and("createdAt").lte(to);
        }

        Query query = new Query(criteria);

        // Free-text search across the readable columns, matching what the screen offers.
        // The user's text is QUOTED first, so characters that mean something special in a
        // search pattern (like "." or "(") are matched literally. Without that, a user could
        // type a pattern that makes the database work extremely hard, or match rows they did
        // not intend.
        if (text != null && !text.isBlank()) {
            Pattern literal = Pattern.compile(Pattern.quote(text.trim()), Pattern.CASE_INSENSITIVE);
            query.addCriteria(new Criteria().orOperator(
                    Criteria.where("actorName").regex(literal),
                    Criteria.where("entityLabel").regex(literal),
                    Criteria.where("action").regex(literal)));
        }

        return query;
    }

    @Override
    public List<AuditEntry> findRecent(String tenantId, int limit) {
        if (limit <= 0) {
            // A non-positive limit would mean "no limit", which is the very thing this class
            // exists to prevent. Refuse loudly rather than quietly loading everything.
            throw new IllegalArgumentException("An audit query must have a positive row limit");
        }
        Query query = new Query(Criteria.where("tenantId").is(tenantId)
                .and("deleted").is(false))
                .with(NEWEST_FIRST)
                .limit(limit);
        return new ArrayList<>(mongoTemplate.find(query, AuditEntry.class));
    }
}
