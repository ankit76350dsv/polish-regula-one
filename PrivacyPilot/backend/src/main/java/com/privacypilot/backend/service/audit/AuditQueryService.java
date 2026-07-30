package com.privacypilot.backend.service;

import com.privacypilot.backend.dto.PageResponse;
import com.privacypilot.backend.dto.audit.AuditEntryResponse;
import com.privacypilot.backend.model.enums.audit.AuditAction;
import com.privacypilot.backend.model.enums.audit.AuditEntityType;
import com.privacypilot.backend.repository.AuditEntryRepository;
import com.privacypilot.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;

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

    /** Rows per page when the caller does not say — a comfortable screenful. */
    public static final int DEFAULT_PAGE_SIZE = 25;

    /**
     * The biggest page anyone may ask for. A screen never needs more than this, and the cap is
     * what stops "?size=999999" from turning back into the unbounded read that used to break
     * this endpoint. Export uses the same ceiling, deliberately: one export = one page.
     */
    public static final int MAX_PAGE_SIZE = 1000;

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
     * @param page       which page to return, counting from 0; null or negative means the first
     * @param size       rows per page; null or non-positive means {@link #DEFAULT_PAGE_SIZE},
     *                   and anything above {@link #MAX_PAGE_SIZE} is trimmed to it
     * @return one page of entries plus the totals the screen needs to draw its pager
     */
    public PageResponse<AuditEntryResponse> list(AuthenticatedUser caller, AuditEntityType entityType,
                                                 String entityId, AuditAction action, String query,
                                                 Instant from, Instant to,
                                                 Integer page, Integer size) {
        // Normalise what the client asked for BEFORE it reaches the database: a sensible page
        // size, never bigger than the ceiling, and never a negative page number.
        int pageNumber = (page == null || page < 0) ? 0 : page;
        int pageSize = (size == null || size <= 0) ? DEFAULT_PAGE_SIZE : Math.min(size, MAX_PAGE_SIZE);

        // Hand the WHOLE question to the database — filters, newest-first order and this one
        // page — so it walks a matching index and reads only the rows being shown.
        return PageResponse.of(
                repository.search(caller.tenantId(), entityType, entityId, action, query, from, to,
                        PageRequest.of(pageNumber, pageSize)),
                AuditEntryResponse::from);
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
