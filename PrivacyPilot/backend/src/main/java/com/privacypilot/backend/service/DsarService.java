package com.privacypilot.backend.service;

import com.privacypilot.backend.dto.dsar.DsarRequest;
import com.privacypilot.backend.dto.dsar.DsarTaskRequest;
import com.privacypilot.backend.model.document.Dsar;
import com.privacypilot.backend.model.embedded.DsarTask;
import com.privacypilot.backend.model.enums.audit.AuditAction;
import com.privacypilot.backend.model.enums.audit.AuditEntityType;
import com.privacypilot.backend.model.enums.dsar.DsarStatus;
import com.privacypilot.backend.repository.DsarRepository;
import com.privacypilot.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Business logic for data-subject requests (DSAR, Art. 15–22 GDPR).
 *
 * Like the sibling services, every method takes the {@link AuthenticatedUser} and
 * scopes the work to THAT user's tenant (tenant isolation), and every change writes an
 * immutable audit entry through {@link AuditService}.
 *
 * A DSAR is SELF-CONTAINED — it links to no other collection (its only child data is
 * the embedded task list) — so the care here is the deadline and the lifecycle:
 *   - the one-month clock (Art. 12(3)) is computed here: dueAt = receivedAt + 1 month,
 *     and + 2 further months when the request is extended (recomputed from receivedAt);
 *   - identity is NEVER auto-verified (Art. 12(6)) — a new request always starts unverified;
 *   - the deadline / status / extension / completion / refusal fields are server-owned:
 *     they change only through create and the dedicated extend/complete/refuse actions,
 *     never through an ordinary edit.
 */
@Service
@RequiredArgsConstructor
public class DsarService {

    private final DsarRepository repository;
    private final AuditService auditService;

    // ── Reads ───────────────────────────────────────────────────────────────────

    /** All requests for the caller's company, most recently recorded first. */
    public List<Dsar> list(AuthenticatedUser caller) {
        return repository.findByTenantIdAndDeletedFalseOrderByCreatedAtDesc(caller.tenantId());
    }

    /** One request, only if it belongs to the caller's company; otherwise 404. */
    public Dsar get(AuthenticatedUser caller, String id) {
        return repository.findByIdAndTenantIdAndDeletedFalse(id, caller.tenantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));
    }

    // ── Writes ──────────────────────────────────────────────────────────────────

    /** Record a new request. Starts IN_PROGRESS and unverified; sets the 1-month deadline. */
    public Dsar create(AuthenticatedUser caller, DsarRequest req, AuditContext ctx) {
        Dsar d = new Dsar();
        d.setTenantId(caller.tenantId());
        d.setStatus(DsarStatus.IN_PROGRESS);
        d.setExtended(false);
        // Never auto-verify — identity must be confirmed by a person before data is released.
        d.setIdentityVerified(false);
        Instant receivedAt = req.getReceivedAt() != null ? req.getReceivedAt() : Instant.now();
        d.setReceivedAt(receivedAt);
        d.setDueAt(plusMonths(receivedAt, 1));
        applyEditable(d, req, false); // don't take identityVerified from the client on create

        Dsar saved = repository.save(d);
        Map<String, Object> newValue = new LinkedHashMap<>();
        newValue.put("type", enumName(saved.getType()));
        newValue.put("requester", saved.getRequesterName());
        newValue.put("dueAt", saved.getDueAt());
        auditService.recordCreate(ctx, AuditEntityType.DSAR, saved.getId(), label(saved), newValue);
        return saved;
    }

    /**
     * Update the editable content of a request: the intake details, the identity
     * verification, the notes and the collection-task list. Does NOT touch the
     * deadline, status, extension, completion or refusal — those are action-only.
     */
    public Dsar update(AuthenticatedUser caller, String id, DsarRequest req, AuditContext ctx) {
        Dsar d = get(caller, id); // 404 if not this tenant's
        Map<String, Object> before = snapshot(d);
        applyEditable(d, req, true); // identity verification comes through the update
        Dsar saved = repository.save(d);

        Map<String, Object> after = snapshot(saved);
        Map<String, Object> oldValue = new LinkedHashMap<>();
        Map<String, Object> newValue = new LinkedHashMap<>();
        for (String key : before.keySet()) {
            if (!Objects.equals(before.get(key), after.get(key))) {
                oldValue.put(key, before.get(key));
                newValue.put(key, after.get(key));
            }
        }
        auditService.record(ctx, AuditAction.UPDATE, AuditEntityType.DSAR, saved.getId(), label(saved),
                oldValue.isEmpty() ? null : oldValue, newValue.isEmpty() ? null : newValue);
        return saved;
    }

    /**
     * Extend the one-month deadline by two further months (Art. 12(3)). Only an
     * in-progress, not-yet-extended request can be extended; the reason is mandatory
     * and recorded, and the new deadline is recomputed from receivedAt (+3 months).
     */
    public Dsar extend(AuthenticatedUser caller, String id, String reason, AuditContext ctx) {
        Dsar d = get(caller, id);
        if (d.getStatus() != DsarStatus.IN_PROGRESS) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only an in-progress request can be extended");
        }
        if (d.isExtended()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This request has already been extended");
        }
        Instant oldDue = d.getDueAt();
        d.setExtended(true);
        d.setExtensionReason(reason);
        d.setDueAt(plusMonths(d.getReceivedAt(), 3));
        Dsar saved = repository.save(d);

        Map<String, Object> oldValue = new LinkedHashMap<>();
        oldValue.put("extended", false);
        oldValue.put("dueAt", oldDue);
        Map<String, Object> newValue = new LinkedHashMap<>();
        newValue.put("extended", true);
        newValue.put("dueAt", saved.getDueAt());
        auditService.record(ctx, AuditAction.UPDATE, AuditEntityType.DSAR, saved.getId(), label(saved),
                oldValue, newValue);
        return saved;
    }

    /** Mark the request completed (answered and closed). */
    public Dsar complete(AuthenticatedUser caller, String id, AuditContext ctx) {
        Dsar d = get(caller, id);
        if (d.getStatus() != DsarStatus.IN_PROGRESS) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This request is already closed");
        }
        String oldStatus = enumName(d.getStatus());
        d.setStatus(DsarStatus.COMPLETED);
        d.setCompletedAt(Instant.now());
        Dsar saved = repository.save(d);
        auditService.record(ctx, AuditAction.UPDATE, AuditEntityType.DSAR, saved.getId(), label(saved),
                mapOf("status", oldStatus), mapOf("status", enumName(saved.getStatus())));
        return saved;
    }

    /** Refuse the request on a lawful ground (Art. 12(5)) — reason is mandatory. */
    public Dsar refuse(AuthenticatedUser caller, String id, String reason, AuditContext ctx) {
        Dsar d = get(caller, id);
        if (d.getStatus() != DsarStatus.IN_PROGRESS) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This request is already closed");
        }
        String oldStatus = enumName(d.getStatus());
        d.setStatus(DsarStatus.REFUSED);
        d.setRefusalReason(reason);
        d.setRefusedAt(Instant.now());
        Dsar saved = repository.save(d);

        Map<String, Object> oldValue = new LinkedHashMap<>();
        oldValue.put("status", oldStatus);
        Map<String, Object> newValue = new LinkedHashMap<>();
        newValue.put("status", enumName(saved.getStatus()));
        newValue.put("refusalReason", saved.getRefusalReason());
        auditService.record(ctx, AuditAction.UPDATE, AuditEntityType.DSAR, saved.getId(), label(saved),
                oldValue, newValue);
        return saved;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────

    // Copy the editable content onto the entity. `takeIdentity` is false on create (a
    // request is never auto-verified) and true on update (that is how identity gets
    // verified). Server-owned lifecycle fields are never touched here.
    private void applyEditable(Dsar d, DsarRequest r, boolean takeIdentity) {
        d.setType(r.getType());
        d.setRequesterName(r.getRequesterName());
        d.setRequesterEmail(r.getRequesterEmail());
        d.setRelation(r.getRelation());
        d.setNotes(r.getNotes());
        d.setIdentityMethod(r.getIdentityMethod());
        if (takeIdentity) {
            d.setIdentityVerified(r.isIdentityVerified());
        }
        d.setTasks(mapTasks(r.getTasks()));
    }

    // Map the validated task DTOs onto the embedded model. Keep the client's id when it
    // edits an existing task; generate one for a brand-new task.
    private static List<DsarTask> mapTasks(List<DsarTaskRequest> requests) {
        List<DsarTask> tasks = new ArrayList<>();
        if (requests == null) {
            return tasks;
        }
        for (DsarTaskRequest r : requests) {
            DsarTask task = new DsarTask();
            task.setId((r.getId() == null || r.getId().isBlank()) ? new ObjectId().toHexString() : r.getId());
            task.setText(r.getText());
            task.setDone(r.isDone());
            tasks.add(task);
        }
        return tasks;
    }

    // Calendar month arithmetic for the deadline (UTC, day-of-month preserved where
    // possible — java.time clamps e.g. Jan 31 + 1 month to the end of February).
    private static Instant plusMonths(Instant base, int months) {
        return base.atZone(ZoneOffset.UTC).plusMonths(months).toInstant();
    }

    // A readable label for the audit trail: "<type> — <requester>".
    private static String label(Dsar d) {
        return enumName(d.getType()) + " — " + (d.getRequesterName() == null ? "?" : d.getRequesterName());
    }

    // A small snapshot of the human-meaningful fields, used to build the audit diff.
    private static Map<String, Object> snapshot(Dsar d) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", enumName(d.getType()));
        m.put("requesterName", d.getRequesterName());
        m.put("relation", d.getRelation());
        m.put("notes", d.getNotes());
        m.put("identityVerified", d.isIdentityVerified());
        m.put("identityMethod", d.getIdentityMethod());
        int total = d.getTasks() == null ? 0 : d.getTasks().size();
        long done = d.getTasks() == null ? 0 : d.getTasks().stream().filter(DsarTask::isDone).count();
        m.put("tasks", done + "/" + total);
        return m;
    }

    // A one-entry map that keeps null values (unlike Map.of), for audit diffs.
    private static Map<String, Object> mapOf(String key, Object value) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put(key, value);
        return m;
    }

    // Null-safe enum name (using the JSON code so the audit reads like the API).
    private static String enumName(Object e) {
        if (e == null) {
            return null;
        }
        if (e instanceof DsarStatus s) {
            return s.getCode();
        }
        if (e instanceof com.privacypilot.backend.model.enums.dsar.DsarType tpe) {
            return tpe.getCode();
        }
        return e.toString();
    }
}
