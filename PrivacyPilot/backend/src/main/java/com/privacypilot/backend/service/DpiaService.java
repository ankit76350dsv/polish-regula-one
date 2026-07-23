package com.privacypilot.backend.service;

import com.privacypilot.backend.dto.dpia.DpiaRiskRequest;
import com.privacypilot.backend.dto.dpia.DpiaUpdateRequest;
import com.privacypilot.backend.model.document.Dpia;
import com.privacypilot.backend.model.document.ProcessingActivity;
import com.privacypilot.backend.model.embedded.DpiaApproval;
import com.privacypilot.backend.model.embedded.DpiaRisk;
import com.privacypilot.backend.model.enums.audit.AuditAction;
import com.privacypilot.backend.model.enums.audit.AuditEntityType;
import com.privacypilot.backend.model.enums.dpia.DpiaStatus;
import com.privacypilot.backend.repository.DpiaRepository;
import com.privacypilot.backend.repository.ProcessingActivityRepository;
import com.privacypilot.backend.security.AuthenticatedUser;
import com.privacypilot.backend.security.PrivacyPilotPermission;
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
 * Business logic for Data Protection Impact Assessments (DPIA, Art. 35 GDPR).
 *
 * Like the ROPA service, every method takes the {@link AuthenticatedUser} and scopes
 * the work to THAT user's tenant (tenant isolation), and every change writes an
 * immutable audit entry through {@link AuditService}.
 *
 * A DPIA is always tied to ONE processing activity. This service therefore also keeps
 * the two sides of that link consistent: it stamps the new DPIA's id onto the parent
 * activity on create, and clears it on archive. It reaches the activity through the
 * {@link ProcessingActivityRepository} (not the activity service) so the two services
 * never depend on each other — no circular dependency.
 */
@Service
@RequiredArgsConstructor
public class DpiaService {

    private final DpiaRepository repository;
    private final ProcessingActivityRepository activityRepository;
    private final AuditService auditService;

    // ── Reads ───────────────────────────────────────────────────────────────────

    /** All live DPIAs for the caller's company, newest change first. */
    public List<Dpia> list(AuthenticatedUser caller) {
        return repository.findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc(caller.tenantId());
    }

    /** One DPIA, only if it belongs to the caller's company; otherwise 404. */
    public Dpia get(AuthenticatedUser caller, String id) {
        return repository.findByIdAndTenantIdAndDeletedFalse(id, caller.tenantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "DPIA not found"));
    }

    //! ── Writes ──────────────────────────────────────────────────────────────────

    /**
     * Open a DPIA for a processing activity. IDEMPOTENT: an activity can have only one
     * DPIA, so if it already has one we return that instead of creating a second.
     *
     * The screening criteria, title and initial description are copied from the linked
     * activity server-side (never trusted from the client), and the two sign-off lines
     * (DPO + Company Admin) are seeded pending.
     */
    public Dpia createForActivity(AuthenticatedUser caller, String activityId, AuditContext ctx) {
        // The DPIA can only be for an activity in the caller's own tenant.
        ProcessingActivity activity = activityRepository
                .findByIdAndTenantIdAndDeletedFalse(activityId, caller.tenantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Activity not found"));

        // Already has a DPIA → return the existing one (one DPIA per activity).
        if (activity.getDpiaId() != null && !activity.getDpiaId().isBlank()) {
            return repository.findByIdAndTenantIdAndDeletedFalse(activity.getDpiaId(), caller.tenantId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "DPIA not found"));
        }

        Dpia d = new Dpia();
        d.setTenantId(caller.tenantId());
        d.setActivityId(activity.getId());
        d.setTitle("DPIA — " + activity.getName());
        d.setStatus(DpiaStatus.IN_PROGRESS);
        // Copy the reason this DPIA exists straight from the activity's screening.
        d.setCriteriaMatched(new ArrayList<>(
                activity.getDpiaCriteria() == null ? List.of() : activity.getDpiaCriteria()));
        // Seed the description from the activity's purpose so the assessor has a start.
        d.setDescription(activity.getPurpose());
        // Two pending sign-off lines: the DPO and the Company Admin (separation of duties).
        d.setApprovals(new ArrayList<>(List.of(
                new DpiaApproval(PrivacyPilotPermission.PRIVACYPILOT_DPO, null, null),
                new DpiaApproval(PrivacyPilotPermission.PRIVACYPILOT_ADMIN, null, null))));

        Dpia saved = repository.save(d);

        // Keep the activity → DPIA back-link so the register shows and gates on it.
        activity.setDpiaId(saved.getId());
        activityRepository.save(activity);

        Map<String, Object> newValue = new LinkedHashMap<>();
        newValue.put("title", saved.getTitle());
        newValue.put("status", enumName(saved.getStatus()));
        newValue.put("activityId", saved.getActivityId());
        auditService.recordCreate(ctx, AuditEntityType.DPIA, saved.getId(), saved.getTitle(), newValue);
        return saved;
    }

    /** Edit the content of a DPIA. Records only the fields that actually changed. */
    public Dpia update(AuthenticatedUser caller, String id, DpiaUpdateRequest req, AuditContext ctx) {
        Dpia d = get(caller, id); // 404 if not this tenant's
        // An approved DPIA is signed-off evidence — it must not be edited afterwards.
        if (d.getStatus() == DpiaStatus.APPROVED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An approved DPIA cannot be edited");
        }

        Map<String, Object> before = snapshot(d);

        d.setDescription(req.getDescription());
        d.setNecessity(req.getNecessity());
        d.setRisks(mapRisks(req.getRisks()));
        d.setMeasures(req.getMeasures() == null ? new ArrayList<>() : new ArrayList<>(req.getMeasures()));
        d.setDpoAdvice(req.getDpoAdvice());
        d.setPriorConsultation(req.isPriorConsultation());
        // Allow DRAFT / IN_PROGRESS / REJECTED here; APPROVED is only reachable by
        // signing every line (see sign()); a null status keeps the current one.
        if (isEditableStatus(req.getStatus())) {
            d.setStatus(req.getStatus());
        }

        Dpia saved = repository.save(d);

        Map<String, Object> after = snapshot(saved);
        Map<String, Object> oldValue = new LinkedHashMap<>();
        Map<String, Object> newValue = new LinkedHashMap<>();
        for (String key : before.keySet()) {
            if (!Objects.equals(before.get(key), after.get(key))) {
                oldValue.put(key, before.get(key));
                newValue.put(key, after.get(key));
            }
        }
        auditService.record(ctx, AuditAction.UPDATE, AuditEntityType.DPIA, saved.getId(), saved.getTitle(),
                oldValue.isEmpty() ? null : oldValue, newValue.isEmpty() ? null : newValue);
        return saved;
    }

    /**
     * Sign the caller's OWN approval line (separation of duties: a DPO signs the DPO
     * line, a Company Admin the Admin line). When every line is signed, the DPIA
     * becomes APPROVED.
     */
    public Dpia sign(AuthenticatedUser caller, String id, AuditContext ctx) {
        Dpia d = get(caller, id);
        if (d.getStatus() == DpiaStatus.APPROVED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This DPIA is already approved");
        }

        // Find the FIRST still-pending line whose role this caller actually holds.
        DpiaApproval slot = null;
        if (d.getApprovals() != null) {
            for (DpiaApproval a : d.getApprovals()) {
                if (a.getApprovedAt() == null && a.getRole() != null
                        && caller.hasAnyPermission(a.getRole())) {
                    slot = a;
                    break;
                }
            }
        }
        if (slot == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "No pending approval slot for your role");
        }

        slot.setName(caller.name());
        slot.setApprovedAt(Instant.now());

        // Fully signed → the DPIA is approved.
        boolean nowApproved = d.getApprovals().stream().allMatch(a -> a.getApprovedAt() != null);
        if (nowApproved) {
            d.setStatus(DpiaStatus.APPROVED);
        }

        Dpia saved = repository.save(d);

        // One SIGN line for this signature; plus an APPROVE line when it becomes final.
        auditService.recordAction(ctx, AuditAction.SIGN, AuditEntityType.DPIA, saved.getId(),
                saved.getTitle() + " — " + slot.getRole().name());
        if (nowApproved) {
            auditService.recordAction(ctx, AuditAction.APPROVE, AuditEntityType.DPIA, saved.getId(), saved.getTitle());
        }
        return saved;
    }

    /**
     * Archive a DPIA — a SOFT delete kept for the 10-year retention rule. Also clears
     * the parent activity's link so a fresh DPIA can be started for it later.
     */
    public void archive(AuthenticatedUser caller, String id, AuditContext ctx) {
        Dpia d = get(caller, id);
        d.setDeleted(true);
        d.setDeletedAt(Instant.now());
        Dpia saved = repository.save(d);

        // Unlink the parent activity if it still points at this DPIA.
        if (saved.getActivityId() != null) {
            activityRepository.findByIdAndTenantIdAndDeletedFalse(saved.getActivityId(), caller.tenantId())
                    .filter(a -> id.equals(a.getDpiaId()))
                    .ifPresent(a -> {
                        a.setDpiaId(null);
                        activityRepository.save(a);
                    });
        }

        Map<String, Object> oldValue = new LinkedHashMap<>();
        oldValue.put("title", saved.getTitle());
        oldValue.put("status", enumName(saved.getStatus()));
        auditService.record(ctx, AuditAction.DELETE, AuditEntityType.DPIA, saved.getId(), saved.getTitle(),
                oldValue, null);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────

    // Map the validated risk DTOs onto the embedded model. Keep the client's id when
    // it edits an existing line; generate a fresh one for a brand-new line.
    private static List<DpiaRisk> mapRisks(List<DpiaRiskRequest> requests) {
        List<DpiaRisk> risks = new ArrayList<>();
        if (requests == null) {
            return risks;
        }
        for (DpiaRiskRequest r : requests) {
            DpiaRisk risk = new DpiaRisk();
            risk.setId((r.getId() == null || r.getId().isBlank())
                    ? new ObjectId().toHexString() : r.getId());
            risk.setDescription(r.getDescription());
            risk.setLikelihood(r.getLikelihood());
            risk.setSeverity(r.getSeverity());
            risk.setMitigation(r.getMitigation());
            risk.setResidualLikelihood(r.getResidualLikelihood());
            risk.setResidualSeverity(r.getResidualSeverity());
            risks.add(risk);
        }
        return risks;
    }

    // The statuses an edit may set. APPROVED is excluded (reachable only by signing);
    // null means "leave the status unchanged".
    private static boolean isEditableStatus(DpiaStatus s) {
        return s == DpiaStatus.DRAFT || s == DpiaStatus.IN_PROGRESS || s == DpiaStatus.REJECTED;
    }

    // A small snapshot of the human-meaningful fields, used to build the audit diff.
    private static Map<String, Object> snapshot(Dpia d) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("status", enumName(d.getStatus()));
        m.put("description", d.getDescription());
        m.put("necessity", d.getNecessity());
        m.put("measures", d.getMeasures());
        m.put("dpoAdvice", d.getDpoAdvice());
        m.put("priorConsultation", d.isPriorConsultation());
        m.put("riskCount", d.getRisks() == null ? 0 : d.getRisks().size());
        return m;
    }

    // Null-safe enum name for audit snapshots.
    private static String enumName(Enum<?> e) {
        return (e == null) ? null : e.name();
    }
}
