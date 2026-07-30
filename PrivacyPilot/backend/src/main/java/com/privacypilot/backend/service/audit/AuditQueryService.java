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
     * EVERY filter, the newest-first order and the row cap are applied BY THE DATABASE
     * (see AuditEntryRepositoryCustom.search). This service only decides the cap and maps
     * the result to the API shape. It used to load the company's whole trail and filter it
     * in Java, which grew unbounded and eventually broke — see the repository for the full
     * explanation. Any argument may be null, meaning "do not filter on it".
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
        // Work out the row cap first: a caller may ask for fewer, never for more, and
        // never for "everything".
        int cap = (limit == null || limit <= 0) ? MAX_LIMIT : Math.min(limit, MAX_LIMIT);

        // Hand the WHOLE question to the database — filters, newest-first order and the cap
        // together — so it walks a matching index and stops as soon as it has enough rows.
        return repository.search(caller.tenantId(), entityType, entityId, action, query,
                        from, to, cap)
                .stream()
                .map(AuditEntryResponse::from)
                .toList();
    }

    /** One audit entry, only if it belongs to the caller's company; otherwise 404. */
    public AuditEntryResponse get(AuthenticatedUser caller, String id) {
        return repository.findByIdAndTenantIdAndDeletedFalse(id, caller.tenantId())
                .map(AuditEntryResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Audit entry not found"));
    }

    // NOTE: the old in-memory text/date/action matching helpers that used to live here were
    // removed — those filters are now part of the database query, so the same rows come back
    // without ever loading the rest of the trail. Nothing about WHAT matches has changed:
    // the search still looks at the actor name, the record label and the action name,
    // case-insensitively (see AuditEntryRepositoryImpl.search).
}
