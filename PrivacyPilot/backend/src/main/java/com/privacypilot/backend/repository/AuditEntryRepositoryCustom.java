package com.privacypilot.backend.repository;

import com.privacypilot.backend.model.document.AuditEntry;
import com.privacypilot.backend.model.enums.audit.AuditAction;
import com.privacypilot.backend.model.enums.audit.AuditEntityType;

import java.time.Instant;
import java.util.List;

/**
 * The hand-written part of the audit-trail repository: ONE search that the database does
 * all of, instead of Java doing it after the fact.
 *
 * WHY THIS EXISTS (the bug it fixes):
 * The audit screen used to work like this — fetch EVERY audit line the company has ever
 * written, then filter, sort and trim the list in Java. The trail is append-only and kept
 * for ten years, so it only ever grows. That code was therefore guaranteed to get slower
 * every day and then break outright: MongoDB refuses to sort more than 32 MB of documents
 * in memory without a suitable index, and long before that a single click could pull
 * hundreds of megabytes into the server. It was also a trivial way to overload the server
 * on purpose — just ask for the trail with no filters, over and over.
 *
 * Now the database receives the WHOLE question at once (filters + newest-first order +
 * "only this many rows"), so it walks a matching index and stops as soon as it has enough
 * rows. Memory use is bounded by the row limit, not by the size of the trail.
 *
 * Spring Data wires the implementation in automatically: the class named
 * {@code AuditEntryRepositoryImpl} in this package is picked up as the body of these
 * methods, and {@link AuditEntryRepository} extends this interface so callers see one
 * repository.
 */
public interface AuditEntryRepositoryCustom {

    /**
     * Search one company's audit trail, newest first, with every filter applied BY THE
     * DATABASE. Any filter may be null, meaning "do not narrow on this".
     *
     * @param tenantId   the company whose trail to read — REQUIRED, this is what keeps one
     *                   company from ever seeing another's log
     * @param entityType only lines about this kind of record (e.g. ACTIVITY), or null
     * @param entityId   only lines about this exact record — the history of one thing, or null
     * @param action     only lines of this action (e.g. EXPORT), or null
     * @param text       free text to look for in the actor name, the record label or the
     *                   action name (case-insensitive). Treated as literal text, never as a
     *                   search pattern, so a user cannot inject one.
     * @param from       only lines at or after this moment, or null
     * @param to         only lines at or before this moment, or null
     * @param limit      the MAXIMUM number of rows to return — must be a positive number,
     *                   because an unbounded read is exactly the problem being fixed
     * @return at most {@code limit} entries, newest first
     */
    List<AuditEntry> search(String tenantId, AuditEntityType entityType, String entityId,
                            AuditAction action, String text, Instant from, Instant to, int limit);

    /**
     * The newest few lines for one company — what the dashboard shows. Same reason as
     * above: the dashboard used to load the entire trail just to display six rows.
     *
     * @param tenantId the company whose trail to read
     * @param limit    how many lines to return (positive)
     */
    List<AuditEntry> findRecent(String tenantId, int limit);
}
