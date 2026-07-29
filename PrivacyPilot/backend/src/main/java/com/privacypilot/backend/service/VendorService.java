package com.privacypilot.backend.service;

import com.privacypilot.backend.dto.vendor.VendorRequest;
import com.privacypilot.backend.model.document.Vendor;
import com.privacypilot.backend.model.enums.audit.AuditAction;
import com.privacypilot.backend.model.enums.audit.AuditEntityType;
import com.privacypilot.backend.model.enums.common.RiskLevel;
import com.privacypilot.backend.model.enums.vendor.DpaStatus;
import com.privacypilot.backend.repository.ProcessingActivityRepository;
import com.privacypilot.backend.repository.TransferRepository;
import com.privacypilot.backend.repository.VendorRepository;
import com.privacypilot.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
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
 * Business logic for processors / sub-processors (Art. 28 GDPR vendors).
 *
 * Like the ROPA service, every method takes the {@link AuthenticatedUser} and scopes
 * the work to THAT user's tenant (tenant isolation), and every change writes an
 * immutable audit entry through {@link AuditService}.
 *
 * A vendor does not stand alone: activities point at it through {@code vendorIds} and
 * transfers through {@code vendorId}. To protect that graph, a vendor cannot be
 * deleted while anything still references it — so this service also reaches the
 * {@link ProcessingActivityRepository} and {@link TransferRepository} (read-only) to
 * check for links before archiving.
 */
@Service
@RequiredArgsConstructor
public class VendorService {

    private final VendorRepository repository;
    // Read-only, used only to protect referential integrity on delete (no service cycle).
    private final ProcessingActivityRepository activityRepository;
    private final TransferRepository transferRepository;
    private final AuditService auditService;

    // ── Reads ───────────────────────────────────────────────────────────────────

    /** All live processors for the caller's company, newest change first. */
    public List<Vendor> list(AuthenticatedUser caller) {
        return repository.findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc(caller.tenantId());
    }

    /** One processor, only if it belongs to the caller's company; otherwise 404. */
    public Vendor get(AuthenticatedUser caller, String id) {
        return repository.findByIdAndTenantIdAndDeletedFalse(id, caller.tenantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Processor not found"));
    }

    // ── Writes ──────────────────────────────────────────────────────────────────

    /** Create a new processor for the caller's company. */
    public Vendor create(AuthenticatedUser caller, VendorRequest req, AuditContext ctx) {
        Vendor v = new Vendor();
        v.setTenantId(caller.tenantId());
        applyRequest(v, req);

        Vendor saved = repository.save(v);
        Map<String, Object> newValue = new LinkedHashMap<>();
        newValue.put("name", saved.getName());
        newValue.put("dpaStatus", enumName(saved.getDpaStatus()));
        newValue.put("riskLevel", enumName(saved.getRiskLevel()));
        auditService.recordCreate(ctx, AuditEntityType.VENDOR, saved.getId(), saved.getName(), newValue);
        return saved;
    }

    /** Update a processor. Records only the fields that actually changed. */
    public Vendor update(AuthenticatedUser caller, String id, VendorRequest req, AuditContext ctx) {
        Vendor v = get(caller, id); // 404 if not this tenant's
        Map<String, Object> before = snapshot(v);
        applyRequest(v, req);
        Vendor saved = repository.save(v);

        Map<String, Object> after = snapshot(saved);
        Map<String, Object> oldValue = new LinkedHashMap<>();
        Map<String, Object> newValue = new LinkedHashMap<>();
        for (String key : before.keySet()) {
            if (!Objects.equals(before.get(key), after.get(key))) {
                oldValue.put(key, before.get(key));
                newValue.put(key, after.get(key));
            }
        }
        auditService.record(ctx, AuditAction.UPDATE, AuditEntityType.VENDOR, saved.getId(), saved.getName(),
                oldValue.isEmpty() ? null : oldValue, newValue.isEmpty() ? null : newValue);
        return saved;
    }

    /**
     * Archive a processor — a SOFT delete kept on disk for the retention rules.
     *
     * REFERENTIAL INTEGRITY: refuse if any live activity or transfer still points at
     * this vendor, so we never leave a dangling Art. 28 link. The user must unlink it
     * from those records first.
     */
    public void archive(AuthenticatedUser caller, String id, AuditContext ctx) {
        Vendor v = get(caller, id);

        if (activityRepository.existsByTenantIdAndVendorIdsAndDeletedFalse(caller.tenantId(), id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This processor is still linked to one or more activities — unlink it there first");
        }
        if (transferRepository.existsByTenantIdAndVendorIdAndDeletedFalse(caller.tenantId(), id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This processor is still linked to a transfer — unlink it there first");
        }

        v.setDeleted(true);
        v.setDeletedAt(Instant.now());
        Vendor saved = repository.save(v);

        Map<String, Object> oldValue = new LinkedHashMap<>();
        oldValue.put("name", saved.getName());
        oldValue.put("dpaStatus", enumName(saved.getDpaStatus()));
        auditService.record(ctx, AuditAction.DELETE, AuditEntityType.VENDOR, saved.getId(), saved.getName(),
                oldValue, null);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────

    // Copy the user-editable fields from the request onto the entity, filling the two
    // enums with the frontend's defaults when they are not supplied. Server-owned base
    // fields (id, tenantId, timestamps, created/updated-by) are never touched here.
    private void applyRequest(Vendor v, VendorRequest r) {
        v.setName(r.getName());
        v.setCountry(r.getCountry());
        v.setRegion(r.getRegion());
        v.setDpaStatus(r.getDpaStatus() != null ? r.getDpaStatus() : DpaStatus.MISSING);
        v.setSubprocessors(r.getSubprocessors() == null ? new ArrayList<>() : new ArrayList<>(r.getSubprocessors()));
        v.setRiskLevel(r.getRiskLevel() != null ? r.getRiskLevel() : RiskLevel.MEDIUM);
        v.setLastReviewAt(r.getLastReviewAt());
    }

    // A small snapshot of the human-meaningful fields, used to build the audit diff.
    private static Map<String, Object> snapshot(Vendor v) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", v.getName());
        m.put("country", v.getCountry());
        m.put("region", v.getRegion());
        m.put("dpaStatus", enumName(v.getDpaStatus()));
        m.put("riskLevel", enumName(v.getRiskLevel()));
        m.put("subprocessors", v.getSubprocessors());
        m.put("lastReviewAt", v.getLastReviewAt());
        return m;
    }

    // Null-safe enum name for audit snapshots.
    private static String enumName(Enum<?> e) {
        return (e == null) ? null : e.name();
    }
}
