package com.privacypilot.backend.service;

import com.privacypilot.backend.dto.breach.BreachRequest;
import com.privacypilot.backend.dto.breach.RemediationItemRequest;
import com.privacypilot.backend.model.document.Breach;
import com.privacypilot.backend.model.embedded.RemediationItem;
import com.privacypilot.backend.model.enums.audit.AuditAction;
import com.privacypilot.backend.model.enums.audit.AuditEntityType;
import com.privacypilot.backend.model.enums.breach.BreachStatus;
import com.privacypilot.backend.repository.BreachRepository;
import com.privacypilot.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Business logic for personal-data breach cases (Art. 33–34 GDPR).
 *
 * Like the sibling services, every method takes the {@link AuthenticatedUser} and
 * scopes the work to THAT user's tenant (tenant isolation), and every change writes an
 * immutable audit entry through {@link AuditService}.
 *
 * A breach is a SELF-CONTAINED record — it does not link to any other collection (its
 * only child data is the embedded remediation list). So there are no cross-entity
 * guards here; the care is in keeping the accountability facts honest: the two
 * "notified at" moments are server-stamped by their own actions and can never be set
 * through an ordinary edit.
 */
@Service
@RequiredArgsConstructor
public class BreachService {

    private final BreachRepository repository;
    private final AuditService auditService;

    // ── Reads ───────────────────────────────────────────────────────────────────

    /** All breaches for the caller's company, most recently recorded first. */
    public List<Breach> list(AuthenticatedUser caller) {
        return repository.findByTenantIdAndDeletedFalseOrderByCreatedAtDesc(caller.tenantId());
    }

    /** One breach, only if it belongs to the caller's company; otherwise 404. */
    public Breach get(AuthenticatedUser caller, String id) {
        return repository.findByIdAndTenantIdAndDeletedFalse(id, caller.tenantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Breach not found"));
    }

    // ── Writes ──────────────────────────────────────────────────────────────────

    /** Record a new breach. Starts OPEN; the 72-hour clock runs from discoveredAt. */
    public Breach create(AuthenticatedUser caller, BreachRequest req, AuditContext ctx) {
        Breach b = new Breach();
        b.setTenantId(caller.tenantId());
        // Server-owned on create: always starts OPEN; awareness time defaults to now.
        b.setStatus(BreachStatus.OPEN);
        b.setDiscoveredAt(req.getDiscoveredAt() != null ? req.getDiscoveredAt() : Instant.now());
        applyRequest(b, req);

        Breach saved = repository.save(b);
        Map<String, Object> newValue = new LinkedHashMap<>();
        newValue.put("title", saved.getTitle());
        newValue.put("status", enumName(saved.getStatus()));
        newValue.put("riskLevel", enumName(saved.getRiskLevel()));
        auditService.recordCreate(ctx, AuditEntityType.BREACH, saved.getId(), saved.getTitle(), newValue);
        return saved;
    }

    /** Update a breach's content, remediation list and OPEN/CLOSED status. */
    public Breach update(AuthenticatedUser caller, String id, BreachRequest req, AuditContext ctx) {
        Breach b = get(caller, id); // 404 if not this tenant's
        Map<String, Object> before = snapshot(b);

        applyRequest(b, req);
        // discoveredAt only moves if the client explicitly sends one (a normal edit
        // keeps the original awareness time). Status may move between OPEN and CLOSED.
        if (req.getDiscoveredAt() != null) {
            b.setDiscoveredAt(req.getDiscoveredAt());
        }
        if (req.getStatus() != null) {
            b.setStatus(req.getStatus());
        }
        // NOTE: uodoNotifiedAt / subjectsNotifiedAt are NOT touched here — they change
        // only through their dedicated actions, so an edit can never fake a notification.

        Breach saved = repository.save(b);
        Map<String, Object> after = snapshot(saved);
        Map<String, Object> oldValue = new LinkedHashMap<>();
        Map<String, Object> newValue = new LinkedHashMap<>();
        for (String key : before.keySet()) {
            if (!Objects.equals(before.get(key), after.get(key))) {
                oldValue.put(key, before.get(key));
                newValue.put(key, after.get(key));
            }
        }
        auditService.record(ctx, AuditAction.UPDATE, AuditEntityType.BREACH, saved.getId(), saved.getTitle(),
                oldValue.isEmpty() ? null : oldValue, newValue.isEmpty() ? null : newValue);
        return saved;
    }

    /** Mark that UODO has now been notified (Art. 33) — stamps the moment server-side. */
    public Breach markUodoNotified(AuthenticatedUser caller, String id, AuditContext ctx) {
        Breach b = get(caller, id);
        Instant oldValue = b.getUodoNotifiedAt();
        b.setUodoNotifiedAt(Instant.now());
        Breach saved = repository.save(b);
        auditService.record(ctx, AuditAction.UPDATE, AuditEntityType.BREACH, saved.getId(), saved.getTitle(),
                mapOf("uodoNotifiedAt", oldValue), mapOf("uodoNotifiedAt", saved.getUodoNotifiedAt()));
        return saved;
    }

    /** Mark that the affected people have now been told directly (Art. 34). */
    public Breach markSubjectsNotified(AuthenticatedUser caller, String id, AuditContext ctx) {
        Breach b = get(caller, id);
        Instant oldValue = b.getSubjectsNotifiedAt();
        b.setSubjectsNotifiedAt(Instant.now());
        Breach saved = repository.save(b);
        auditService.record(ctx, AuditAction.UPDATE, AuditEntityType.BREACH, saved.getId(), saved.getTitle(),
                mapOf("subjectsNotifiedAt", oldValue), mapOf("subjectsNotifiedAt", saved.getSubjectsNotifiedAt()));
        return saved;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────

    // Copy the user-editable fields onto the entity. Server-owned fields (id, tenantId,
    // timestamps, uodoNotifiedAt, subjectsNotifiedAt) are NOT here; status/discoveredAt
    // are handled by the callers so create and update can treat them differently.
    private void applyRequest(Breach b, BreachRequest r) {
        b.setTitle(r.getTitle());
        b.setRiskLevel(r.getRiskLevel());
        b.setDescription(r.getDescription());
        b.setSubjectsCount(r.getSubjectsCount());
        b.setRecordsCount(r.getRecordsCount());
        b.setDataCategories(r.getDataCategories() == null ? new ArrayList<>() : new ArrayList<>(r.getDataCategories()));
        b.setUodoNotificationRequired(r.isUodoNotificationRequired());
        b.setSubjectsNotificationRequired(r.isSubjectsNotificationRequired());
        b.setRiskRationale(r.getRiskRationale());
        b.setUodoReference(r.getUodoReference());
        b.setRemediation(mapRemediation(r.getRemediation()));
    }

    // Map the validated remediation DTOs onto the embedded model. Keep the client's id
    // when it edits an existing action; generate one for a brand-new action.
    private static List<RemediationItem> mapRemediation(List<RemediationItemRequest> requests) {
        List<RemediationItem> items = new ArrayList<>();
        if (requests == null) {
            return items;
        }
        for (RemediationItemRequest r : requests) {
            RemediationItem item = new RemediationItem();
            item.setId((r.getId() == null || r.getId().isBlank()) ? new ObjectId().toHexString() : r.getId());
            item.setText(r.getText());
            item.setDone(r.isDone());
            items.add(item);
        }
        return items;
    }

    // A small snapshot of the human-meaningful fields, used to build the audit diff.
    private static Map<String, Object> snapshot(Breach b) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("title", b.getTitle());
        m.put("status", enumName(b.getStatus()));
        m.put("riskLevel", enumName(b.getRiskLevel()));
        m.put("uodoNotificationRequired", b.isUodoNotificationRequired());
        m.put("subjectsNotificationRequired", b.isSubjectsNotificationRequired());
        m.put("uodoReference", b.getUodoReference());
        m.put("riskRationale", b.getRiskRationale());
        m.put("subjectsCount", b.getSubjectsCount());
        m.put("recordsCount", b.getRecordsCount());
        // Count of completed / total actions — enough to show remediation progress in the log.
        int total = b.getRemediation() == null ? 0 : b.getRemediation().size();
        long done = b.getRemediation() == null ? 0 : b.getRemediation().stream().filter(RemediationItem::isDone).count();
        m.put("remediation", done + "/" + total);
        return m;
    }

    // A one-entry map that keeps null values (LinkedHashMap, unlike Map.of) so an audit
    // diff can show "was null → now set".
    private static Map<String, Object> mapOf(String key, Object value) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put(key, value);
        return m;
    }

    // Null-safe enum name for audit snapshots.
    private static String enumName(Enum<?> e) {
        return (e == null) ? null : e.name();
    }
}
