package com.privacypilot.backend.repository;

import com.privacypilot.backend.model.document.AuditEntry;
import com.privacypilot.backend.model.enums.audit.AuditAction;
import com.privacypilot.backend.model.enums.audit.AuditEntityType;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

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

    @Override
    public List<AuditEntry> search(String tenantId, AuditEntityType entityType, String entityId,
                                   AuditAction action, String text, Instant from, Instant to,
                                   int limit) {
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

        return runNewestFirst(query, limit);
    }

    @Override
    public List<AuditEntry> findRecent(String tenantId, int limit) {
        Query query = new Query(Criteria.where("tenantId").is(tenantId)
                .and("deleted").is(false));
        return runNewestFirst(query, limit);
    }

    // Apply the newest-first order and the row cap, then run it. Both are part of the
    // database query on purpose — that is what keeps memory bounded.
    private List<AuditEntry> runNewestFirst(Query query, int limit) {
        if (limit <= 0) {
            // A non-positive limit would mean "no limit", which is the very thing this class
            // exists to prevent. Refuse loudly rather than quietly loading everything.
            throw new IllegalArgumentException("An audit query must have a positive row limit");
        }
        query.with(Sort.by(Sort.Direction.DESC, "createdAt")).limit(limit);
        return new ArrayList<>(mongoTemplate.find(query, AuditEntry.class));
    }
}
