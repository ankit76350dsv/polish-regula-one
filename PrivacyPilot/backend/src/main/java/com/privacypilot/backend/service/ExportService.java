package com.privacypilot.backend.service;

import com.privacypilot.backend.dto.export.ExportRequest;
import com.privacypilot.backend.model.document.AuditEntry;
import com.privacypilot.backend.model.document.Breach;
import com.privacypilot.backend.model.document.PrivacyNotice;
import com.privacypilot.backend.model.enums.audit.AuditAction;
import com.privacypilot.backend.model.enums.export.ExportTarget;
import com.privacypilot.backend.repository.BreachRepository;
import com.privacypilot.backend.repository.PrivacyNoticeRepository;
import com.privacypilot.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Records that data was TAKEN OUT of PrivacyPilot — downloaded, printed, or copied.
 *
 * WHY THIS EXISTS (the bug it fixes):
 * The audit trail could already prove who CHANGED a record, but not who took a COPY of
 * one. Every export happened entirely inside the browser: the whole Art. 30 register was
 * turned into a CSV, and the audit trail itself into a JSON file, without the server ever
 * hearing about it. So the one document whose job is to demonstrate accountability
 * (GDPR Art. 5(2)) showed nothing at all when the entire register walked out of the door.
 * {@code AuditAction.EXPORT} existed in the code and was never once written.
 *
 * HOW IT WORKS NOW: before the browser produces any file, print view or clipboard copy it
 * must call this service. The export is recorded as one immutable EXPORT line, and the
 * browser only produces the file if that line was written. If the recording fails, the
 * export does not happen — the rule is "no evidence, no copy".
 *
 * WHAT IS TRUSTED: nothing about the actor. Who did it, for which company, from which IP
 * and browser all come from the verified session via {@link AuditContext}. The caller may
 * only state WHAT was copied, HOW, and HOW MUCH.
 *
 * HONEST LIMIT: this records the export EVENT; it does not itself generate the file, so a
 * determined person who is already allowed to read the data could still call the ordinary
 * read APIs and assemble their own copy without a line being written. Closing that fully
 * means generating every export server-side, which needs the bilingual (Polish/English)
 * register labels that today live only in the frontend. This service is the accountability
 * record for the app's real export paths, not a data-loss-prevention control.
 */
@Service
@RequiredArgsConstructor
public class ExportService {

    // Only needed to CHECK that a single-document export really is about one of the
    // caller's own records, so a client cannot write an audit line about someone else's.
    private final PrivacyNoticeRepository noticeRepository;
    private final BreachRepository breachRepository;
    private final AuditService auditService;

    /**
     * Write the EXPORT audit line for one export, and hand back the saved entry as a
     * receipt.
     *
     * @param caller the signed-in user (company + identity come from here)
     * @param req    what was copied, how, and how much
     * @param ctx    who/where, gathered once per request by the controller
     * @return the audit entry that was written
     * @throws ResponseStatusException 400 when a single-document export has no id,
     *                                 404 when that id is not one of this company's records
     */
    public AuditEntry record(AuthenticatedUser caller, ExportRequest req, AuditContext ctx) {
        ExportTarget target = req.getTarget();

        // For a single-document export we must know WHICH document, and it has to be one
        // of this company's own. Checking first means the trail can never contain a line
        // about a record that does not exist or belongs to another tenant.
        String entityId = null;
        String label = target.getLabel();
        if (target.requiresEntityId()) {
            entityId = requireEntityId(req.getEntityId());
            label = label + " — " + describeEntity(caller, target, entityId);
        }

        // The "after" values of an export line describe the copy itself: what, how, how
        // big, and which filters were on screen. There is no "before" state for a copy.
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("target", target.getCode());
        details.put("format", req.getFormat().getCode());
        if (req.getItemCount() != null) {
            details.put("itemCount", req.getItemCount());
        }
        if (req.getFilterSummary() != null && !req.getFilterSummary().isBlank()) {
            details.put("filters", req.getFilterSummary().trim());
        }

        return auditService.record(ctx, AuditAction.EXPORT, target.getEntityType(),
                entityId, label, null, details);
    }

    // A single-document export without an id would produce a useless audit line.
    private static String requireEntityId(String entityId) {
        if (entityId == null || entityId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "entityId is required for this export");
        }
        return entityId;
    }

    // Look the record up in the caller's OWN company and return a readable name for the
    // audit line. A record that is missing — or belongs to someone else — is a 404, which
    // is also what stops one company probing another's ids through this endpoint.
    private String describeEntity(AuthenticatedUser caller, ExportTarget target, String entityId) {
        String tenantId = caller.tenantId();
        return switch (target) {
            case PRIVACY_NOTICE -> noticeRepository
                    .findByIdAndTenantIdAndDeletedFalse(entityId, tenantId)
                    .map(ExportService::noticeLabel)
                    .orElseThrow(() -> notFound("Notice not found"));
            case BREACH_REPORT -> breachRepository
                    .findByIdAndTenantIdAndDeletedFalse(entityId, tenantId)
                    .map(Breach::getTitle)
                    .orElseThrow(() -> notFound("Breach not found"));
            // Whole-list targets never reach here (requiresEntityId is false for them).
            default -> throw notFound("Unsupported export target");
        };
    }

    // "employees v3" reads better in the trail than a raw id.
    private static String noticeLabel(PrivacyNotice n) {
        String audience = (n.getAudience() == null) ? "?" : n.getAudience().getCode();
        return audience + " v" + n.getVersion();
    }

    private static ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }
}
