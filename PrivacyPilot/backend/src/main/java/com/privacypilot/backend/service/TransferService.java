package com.privacypilot.backend.service;

import com.privacypilot.backend.dto.transfer.TransferRequest;
import com.privacypilot.backend.model.document.Transfer;
import com.privacypilot.backend.model.enums.audit.AuditAction;
import com.privacypilot.backend.model.enums.audit.AuditEntityType;
import com.privacypilot.backend.repository.ProcessingActivityRepository;
import com.privacypilot.backend.repository.TransferRepository;
import com.privacypilot.backend.repository.VendorRepository;
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
 * Business logic for third-country transfers (GDPR Chapter V).
 *
 * Like the sibling services, every method takes the {@link AuthenticatedUser} and
 * scopes the work to THAT user's tenant (tenant isolation), and every change writes an
 * immutable audit entry through {@link AuditService}.
 *
 * A transfer sits between a vendor and an activity, so this service protects that graph
 * (all reached through repositories, so no service-to-service cycle):
 *   - on create/update, an optional vendorId must belong to the caller's own tenant —
 *     a transfer can never point at a missing or another company's processor;
 *   - on delete, the transfer cannot be archived while an activity still lists it in
 *     its transferIds — no dangling Art. 30(1)(e) link is ever left behind.
 * (The activity→transfer link lives only on the activity's transferIds list.)
 */
@Service
@RequiredArgsConstructor
public class TransferService {

    private final TransferRepository repository;
    // Read-only, used to validate the optional links and protect delete integrity.
    private final VendorRepository vendorRepository;
    private final ProcessingActivityRepository activityRepository;
    private final AuditService auditService;

    // ── Reads ───────────────────────────────────────────────────────────────────

    /** All live transfers for the caller's company, newest change first. */
    public List<Transfer> list(AuthenticatedUser caller) {
        return repository.findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc(caller.tenantId());
    }

    /** One transfer, only if it belongs to the caller's company; otherwise 404. */
    public Transfer get(AuthenticatedUser caller, String id) {
        return repository.findByIdAndTenantIdAndDeletedFalse(id, caller.tenantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transfer not found"));
    }

    // ── Writes ──────────────────────────────────────────────────────────────────

    /** Create a new transfer for the caller's company. */
    public Transfer create(AuthenticatedUser caller, TransferRequest req, AuditContext ctx) {
        validateLinks(caller, req);
        Transfer t = new Transfer();
        t.setTenantId(caller.tenantId());
        applyRequest(t, req);

        Transfer saved = repository.save(t);
        Map<String, Object> newValue = new LinkedHashMap<>();
        newValue.put("recipient", saved.getRecipient());
        newValue.put("destinationCountry", saved.getDestinationCountry());
        newValue.put("mechanism", enumName(saved.getMechanism()));
        auditService.recordCreate(ctx, AuditEntityType.TRANSFER, saved.getId(), label(saved), newValue);
        return saved;
    }

    /** Update a transfer. Records only the fields that actually changed. */
    public Transfer update(AuthenticatedUser caller, String id, TransferRequest req, AuditContext ctx) {
        Transfer t = get(caller, id); // 404 if not this tenant's
        validateLinks(caller, req);
        Map<String, Object> before = snapshot(t);
        applyRequest(t, req);
        Transfer saved = repository.save(t);

        Map<String, Object> after = snapshot(saved);
        Map<String, Object> oldValue = new LinkedHashMap<>();
        Map<String, Object> newValue = new LinkedHashMap<>();
        for (String key : before.keySet()) {
            if (!Objects.equals(before.get(key), after.get(key))) {
                oldValue.put(key, before.get(key));
                newValue.put(key, after.get(key));
            }
        }
        auditService.record(ctx, AuditAction.UPDATE, AuditEntityType.TRANSFER, saved.getId(), label(saved),
                oldValue.isEmpty() ? null : oldValue, newValue.isEmpty() ? null : newValue);
        return saved;
    }

    /**
     * Archive a transfer — a SOFT delete kept on disk for the retention rules.
     *
     * REFERENTIAL INTEGRITY: refuse if any live activity still lists this transfer in
     * its transferIds, so we never leave a dangling Chapter V link. The user must
     * unlink it from the activity first.
     */
    public void archive(AuthenticatedUser caller, String id, AuditContext ctx) {
        Transfer t = get(caller, id);

        if (activityRepository.existsByTenantIdAndTransferIdsAndDeletedFalse(caller.tenantId(), id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This transfer is still linked to one or more activities — unlink it there first");
        }

        t.setDeleted(true);
        t.setDeletedAt(Instant.now());
        Transfer saved = repository.save(t);

        Map<String, Object> oldValue = new LinkedHashMap<>();
        oldValue.put("recipient", saved.getRecipient());
        oldValue.put("destinationCountry", saved.getDestinationCountry());
        auditService.record(ctx, AuditAction.DELETE, AuditEntityType.TRANSFER, saved.getId(), label(saved),
                oldValue, null);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────

    // Verify the optional vendor link points at the caller's OWN live processor. A
    // blank id means "no link". A non-existent / other-tenant id is a bad request → 404.
    private void validateLinks(AuthenticatedUser caller, TransferRequest req) {
        String vendorId = blankToNull(req.getVendorId());
        if (vendorId != null
                && vendorRepository.findByIdAndTenantIdAndDeletedFalse(vendorId, caller.tenantId()).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Linked processor (vendor) not found");
        }
    }

    // Copy the user-editable fields onto the entity. A blank vendor id is stored as
    // null (a true "no link"). Server-owned base fields are never touched.
    private void applyRequest(Transfer t, TransferRequest r) {
        t.setVendorId(blankToNull(r.getVendorId()));
        t.setDestinationCountry(r.getDestinationCountry());
        t.setRecipient(r.getRecipient());
        t.setMechanism(r.getMechanism());
        t.setAdequacyNote(r.getAdequacyNote());
        t.setTiaDocumented(r.isTiaDocumented());
        t.setTiaRef(r.getTiaRef());
    }

    // A readable label for the audit trail: "recipient → country".
    private static String label(Transfer t) {
        return (t.getRecipient() == null ? "?" : t.getRecipient())
                + " → " + (t.getDestinationCountry() == null ? "?" : t.getDestinationCountry());
    }

    // A small snapshot of the human-meaningful fields, used to build the audit diff.
    private static Map<String, Object> snapshot(Transfer t) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("vendorId", t.getVendorId());
        m.put("destinationCountry", t.getDestinationCountry());
        m.put("recipient", t.getRecipient());
        m.put("mechanism", enumName(t.getMechanism()));
        m.put("adequacyNote", t.getAdequacyNote());
        m.put("tiaDocumented", t.isTiaDocumented());
        m.put("tiaRef", t.getTiaRef());
        return m;
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    // Null-safe enum name for audit snapshots.
    private static String enumName(Enum<?> e) {
        return (e == null) ? null : e.name();
    }
}
