package com.privacypilot.backend.service;

import com.privacypilot.backend.dto.audit.AuditEntryResponse;
import com.privacypilot.backend.model.document.AuditEntry;
import com.privacypilot.backend.model.enums.audit.AuditAction;
import com.privacypilot.backend.model.enums.audit.AuditEntityType;
import com.privacypilot.backend.repository.AuditEntryRepository;
import com.privacypilot.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

/**
 * READ side of the audit trail.
 *
 * Writes go through {@link AuditService} (insert-only, so the trail stays tamper
 * resistant). This service does the opposite job: it lets the audit-trail screen and
 * an auditor READ the trail — always scoped to the caller's own company, so one
 * tenant can never see another's log.
 *
 * It never changes a record; every method here is a pure query.
 */
@Service
@RequiredArgsConstructor
public class AuditQueryService {

    private final AuditEntryRepository repository;

    // Never return an unbounded trail in one go — a 10-year log can be huge. Callers
    // may ask for fewer with ?limit=, but never more than this hard ceiling.
    private static final int MAX_LIMIT = 1000;

    /**
     * List the caller's audit entries, newest first, with optional filters.
     *
     * The database narrows on the most selective filter it can (a single record's
     * history, or one entity type); the remaining optional filters (action, date
     * range and a free-text search) are applied in memory on that already-scoped,
     * already-ordered list. Any argument may be null, meaning "do not filter on it".
     *
     * @param caller     the signed-in user (tenant + identity come from here)
     * @param entityType only entries about this kind of record (e.g. ACTIVITY), or null
     * @param entityId   only entries about this exact record id, or null
     * @param action     only entries of this action (e.g. UPDATE), or null
     * @param query      free-text match on actor name / entity label / action, or null
     * @param from       only entries at or after this time, or null
     * @param to         only entries at or before this time, or null
     * @param limit      max rows to return (defaults to {@link #MAX_LIMIT}, capped there)
     */
    public List<AuditEntryResponse> list(AuthenticatedUser caller, AuditEntityType entityType,
                                         String entityId, AuditAction action, String query,
                                         Instant from, Instant to, Integer limit) {
        String tenantId = caller.tenantId();

        // 1) Pull the most tightly-scoped list the DB can give us, already newest-first.
        List<AuditEntry> rows;
        if (entityId != null && !entityId.isBlank()) {
            rows = repository.findByTenantIdAndEntityIdAndDeletedFalseOrderByCreatedAtDesc(tenantId, entityId);
        } else if (entityType != null) {
            rows = repository.findByTenantIdAndEntityTypeAndDeletedFalseOrderByCreatedAtDesc(tenantId, entityType);
        } else {
            rows = repository.findByTenantIdAndDeletedFalseOrderByCreatedAtDesc(tenantId);
        }

        // 2) Apply the remaining optional filters in memory, then cap the size.
        String needle = (query == null || query.isBlank()) ? null : query.trim().toLowerCase();
        int cap = (limit == null || limit <= 0) ? MAX_LIMIT : Math.min(limit, MAX_LIMIT);

        return rows.stream()
                .filter(e -> action == null || e.getAction() == action)
                .filter(e -> from == null || (e.getCreatedAt() != null && !e.getCreatedAt().isBefore(from)))
                .filter(e -> to == null || (e.getCreatedAt() != null && !e.getCreatedAt().isAfter(to)))
                .filter(e -> needle == null || matchesText(e, needle))
                .limit(cap)
                .map(AuditEntryResponse::from)
                .toList();
    }

    /** One audit entry, only if it belongs to the caller's company; otherwise 404. */
    public AuditEntryResponse get(AuthenticatedUser caller, String id) {
        return repository.findByIdAndTenantIdAndDeletedFalse(id, caller.tenantId())
                .map(AuditEntryResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Audit entry not found"));
    }

    // Free-text search over the human-readable columns (case-insensitive), matching
    // exactly what the audit-trail screen searches on.
    private static boolean matchesText(AuditEntry e, String needle) {
        return contains(e.getActorName(), needle)
                || contains(e.getEntityLabel(), needle)
                || (e.getAction() != null && e.getAction().getCode().toLowerCase().contains(needle));
    }

    private static boolean contains(String value, String needle) {
        return value != null && value.toLowerCase().contains(needle);
    }
}
