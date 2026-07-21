package com.privacypilot.backend.service;

import com.privacypilot.backend.dto.activity.ActivityRequest;
import com.privacypilot.backend.model.document.ProcessingActivity;
import com.privacypilot.backend.model.enums.activity.ActivityStatus;
import com.privacypilot.backend.model.enums.dpia.DpiaCriterion;
import com.privacypilot.backend.model.enums.dpia.DpiaVerdict;
import com.privacypilot.backend.model.enums.audit.AuditAction;
import com.privacypilot.backend.model.enums.audit.AuditEntityType;
import com.privacypilot.backend.repository.ProcessingActivityRepository;
import com.privacypilot.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Business logic for the Record of Processing Activities (ROPA, Art. 30 GDPR).
 *
 * Every method takes the {@link AuthenticatedUser} and scopes the work to THAT user's
 * tenant, so one company can never touch another's register (tenant isolation). Every
 * change writes an immutable audit entry through {@link AuditService}, and the DPIA
 * verdict is (re)computed here from the screening criteria — the client never sets it.
 */
@Service
@RequiredArgsConstructor
public class ProcessingActivityService {

    private final ProcessingActivityRepository repository;
    private final AuditService auditService;

    // ── Reads ───────────────────────────────────────────────────────────────────

    /** All live entries for the caller's company, newest change first. */
    public List<ProcessingActivity> list(AuthenticatedUser caller) {
        return repository.findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc(caller.tenantId());
    }

    /** One entry, only if it belongs to the caller's company; otherwise 404. */
    public ProcessingActivity get(AuthenticatedUser caller, String id) {
        return repository.findByIdAndTenantIdAndDeletedFalse(id, caller.tenantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Activity not found"));
    }

    // ── Writes ──────────────────────────────────────────────────────────────────

    /** Create a new activity for the caller's company. Starts as DRAFT. */
    public ProcessingActivity create(AuthenticatedUser caller, ActivityRequest req, AuditContext ctx) {
        ProcessingActivity a = new ProcessingActivity();
        // Server-owned fields — set from the verified session, never the client.
        a.setTenantId(caller.tenantId());
        a.setOwnerName(caller.name());
        a.setStatus(ActivityStatus.DRAFT);
        applyRequest(a, req);
        a.setDpiaVerdict(verdictFor(a.getDpiaCriteria()));

        ProcessingActivity saved = repository.save(a);
        Map<String, Object> newValue = new LinkedHashMap<>();
        newValue.put("name", saved.getName());
        newValue.put("status", enumName(saved.getStatus()));
        newValue.put("dpiaVerdict", enumName(saved.getDpiaVerdict()));
        auditService.recordCreate(ctx, AuditEntityType.ACTIVITY, saved.getId(), saved.getName(), newValue);
        return saved;
    }

    /** Update an existing activity. Records only the fields that actually changed. */
    public ProcessingActivity update(AuthenticatedUser caller, String id, ActivityRequest req, AuditContext ctx) {
        ProcessingActivity a = get(caller, id); // 404 if not this tenant's
        Map<String, Object> before = snapshot(a);
        applyRequest(a, req);
        a.setDpiaVerdict(verdictFor(a.getDpiaCriteria()));
        ProcessingActivity saved = repository.save(a);

        Map<String, Object> after = snapshot(saved);
        Map<String, Object> oldValue = new LinkedHashMap<>();
        Map<String, Object> newValue = new LinkedHashMap<>();
        for (String key : before.keySet()) {
            if (!Objects.equals(before.get(key), after.get(key))) {
                oldValue.put(key, before.get(key));
                newValue.put(key, after.get(key));
            }
        }
        auditService.record(ctx, AuditAction.UPDATE, AuditEntityType.ACTIVITY, saved.getId(), saved.getName(),
                oldValue.isEmpty() ? null : oldValue, newValue.isEmpty() ? null : newValue);
        return saved;
    }

    /** Approve (sign off) an activity. */
    public ProcessingActivity approve(AuthenticatedUser caller, String id, AuditContext ctx) {
        ProcessingActivity a = get(caller, id);
        // NOTE: once the DPIA module exists, block approval of a "DPIA required" activity
        // whose linked DPIA is not yet approved (Art. 35(1)). Left as a follow-up.
        String oldStatus = enumName(a.getStatus());
        a.setStatus(ActivityStatus.APPROVED);
        ProcessingActivity saved = repository.save(a);

        Map<String, Object> oldValue = new LinkedHashMap<>();
        oldValue.put("status", oldStatus);
        Map<String, Object> newValue = new LinkedHashMap<>();
        newValue.put("status", enumName(saved.getStatus()));
        auditService.record(ctx, AuditAction.APPROVE, AuditEntityType.ACTIVITY, saved.getId(), saved.getName(),
                oldValue, newValue);
        return saved;
    }

    /**
     * Archive an activity — a SOFT delete. The row is hidden from the register but
     * kept on disk for the 10-year retention rule; the audit entry records it.
     */
    public void archive(AuthenticatedUser caller, String id, AuditContext ctx) {
        ProcessingActivity a = get(caller, id);
        a.setDeleted(true);
        a.setDeletedAt(Instant.now());
        ProcessingActivity saved = repository.save(a);

        Map<String, Object> oldValue = new LinkedHashMap<>();
        oldValue.put("name", saved.getName());
        oldValue.put("status", enumName(saved.getStatus()));
        // A delete has no "after" state.
        auditService.record(ctx, AuditAction.DELETE, AuditEntityType.ACTIVITY, saved.getId(), saved.getName(),
                oldValue, null);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────

    // Copy the user-editable fields from the request onto the entity. Server-owned
    // fields (id, tenantId, status, dpiaVerdict, dpiaId, owner, timestamps) are NOT here.
    private void applyRequest(ProcessingActivity a, ActivityRequest r) {
        a.setName(r.getName());
        a.setDepartment(r.getDepartment());
        a.setRole(r.getRole());
        a.setControllersServed(r.getControllersServed());
        a.setPurpose(r.getPurpose());
        a.setLawfulBasis(r.getLawfulBasis());
        a.setLegitimateInterestDetail(r.getLegitimateInterestDetail());
        a.setProvisionStatement(r.getProvisionStatement());
        a.setDataSubjects(r.getDataSubjects());
        a.setDataCategories(r.getDataCategories());
        a.setArt9Condition(r.getArt9Condition());
        a.setArt10(r.isArt10());
        a.setDataSources(r.getDataSources());
        a.setRecipients(r.getRecipients());
        a.setVendorIds(r.getVendorIds());
        a.setTransfer(r.isTransfer());
        a.setTransferIds(r.getTransferIds());
        a.setRetentionPeriod(r.getRetentionPeriod());
        a.setRetentionBasis(r.getRetentionBasis());
        a.setToms(r.getToms());
        a.setDpiaCriteria(r.getDpiaCriteria());
    }

    /**
     * Turn the matched UODO DPIA criteria into the verdict (M.P. 2019 poz. 666, under
     * Art. 35): two or more criteria → a DPIA is REQUIRED; exactly one → RECOMMENDED;
     * none → NOT_INDICATED. This mirrors the EDPB "two-criteria" rule of thumb.
     */
    private static DpiaVerdict verdictFor(List<DpiaCriterion> criteria) {
        int matched = (criteria == null) ? 0 : criteria.size();
        if (matched >= 2) {
            return DpiaVerdict.REQUIRED;
        }
        if (matched == 1) {
            return DpiaVerdict.RECOMMENDED;
        }
        return DpiaVerdict.NOT_INDICATED;
    }

    // A small snapshot of the human-meaningful fields, used to build the audit diff.
    private static Map<String, Object> snapshot(ProcessingActivity a) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", a.getName());
        m.put("purpose", a.getPurpose());
        m.put("status", enumName(a.getStatus()));
        m.put("lawfulBasis", enumName(a.getLawfulBasis()));
        m.put("retentionPeriod", a.getRetentionPeriod());
        m.put("dpiaVerdict", enumName(a.getDpiaVerdict()));
        return m;
    }

    // Null-safe enum name for audit snapshots.
    private static String enumName(Enum<?> e) {
        return (e == null) ? null : e.name();
    }
}
