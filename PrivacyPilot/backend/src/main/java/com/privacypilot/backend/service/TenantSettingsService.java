package com.privacypilot.backend.service;

import com.privacypilot.backend.dto.settings.SettingsRequest;
import com.privacypilot.backend.dto.settings.SettingsResponse;
import com.privacypilot.backend.model.document.Tenant;
import com.privacypilot.backend.model.document.TenantSettings;
import com.privacypilot.backend.model.embedded.AiPreferences;
import com.privacypilot.backend.model.embedded.DpoDetails;
import com.privacypilot.backend.model.enums.audit.AuditAction;
import com.privacypilot.backend.model.enums.audit.AuditEntityType;
import com.privacypilot.backend.repository.TenantRepository;
import com.privacypilot.backend.repository.TenantSettingsRepository;
import com.privacypilot.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Business logic for a company's PrivacyPilot settings.
 *
 * Two things live here and are OWNED by PrivacyPilot: the DPO contact (+ Art. 10/11
 * designation tracking) and the AI preferences. There is ONE such document per tenant,
 * so this is a read-one / upsert service, scoped to the caller's tenant.
 *
 * The company's LEGAL IDENTITY is NOT owned here — RegulaOne owns the shared "tenants"
 * collection and its company-profile page edits it. On read we simply LOOK UP the tenant
 * and merge its identity into the response (read-only), so callers get one object. On
 * write we save ONLY dpo + ai; the company can never be changed through this API.
 *
 * WHY this matters elsewhere: the ROPA register header (Art. 30(1)(a)) and every privacy
 * notice / breach report (Art. 13(1)(a)(b)) read the controller + DPO identity from the
 * response. The DPO *permission* (who may act as DPO in the app) stays on the Users page
 * (RegulaOne RBAC); the DPO *contact* stored here is the published contact + designation
 * paperwork, a separate per-company compliance fact.
 */
@Service
@RequiredArgsConstructor
public class TenantSettingsService {

    private final TenantSettingsRepository repository;
    private final TenantRepository tenantRepository;
    private final AuditService auditService;

    /**
     * The caller's company settings. If no PrivacyPilot settings have been saved yet,
     * returns a fresh EMPTY dpo/ai block (not persisted until the first save); the
     * company block is always filled from the RegulaOne tenant.
     */
    public SettingsResponse get(AuthenticatedUser caller) {
        TenantSettings settings = loadOrBlank(caller);
        return SettingsResponse.of(settings, loadTenant(caller));
    }

    /**
     * Save the PrivacyPilot settings — UPSERT of the DPO + AI groups only. Records the
     * change in the audit trail and returns the merged view (company + dpo + ai).
     */
    public SettingsResponse update(AuthenticatedUser caller, SettingsRequest req, AuditContext ctx) {
        TenantSettings settings = loadOrBlank(caller);

        Map<String, Object> before = snapshot(settings);

        // Apply the two editable groups, guarding against null so a partial payload can't
        // wipe a whole group to null (missing group → keep the current one). The company
        // is intentionally NOT applied here — it belongs to RegulaOne.
        if (req.getDpo() != null) {
            settings.setDpo(req.getDpo());
        }
        if (req.getAi() != null) {
            settings.setAi(req.getAi());
        }

        TenantSettings saved = repository.save(settings);

        Map<String, Object> after = snapshot(saved);
        Map<String, Object> oldValue = new LinkedHashMap<>();
        Map<String, Object> newValue = new LinkedHashMap<>();
        for (String key : before.keySet()) {
            if (!Objects.equals(before.get(key), after.get(key))) {
                oldValue.put(key, before.get(key));
                newValue.put(key, after.get(key));
            }
        }
        // The tenant's own name is a reasonable label for the settings record.
        auditService.record(ctx, AuditAction.UPDATE, AuditEntityType.SETTINGS, saved.getId(),
                caller.tenantName(),
                oldValue.isEmpty() ? null : oldValue, newValue.isEmpty() ? null : newValue);

        return SettingsResponse.of(saved, loadTenant(caller));
    }

    // Load this tenant's settings row, or a fresh blank one (with the tenant set) that
    // will be persisted on the first save.
    private TenantSettings loadOrBlank(AuthenticatedUser caller) {
        return repository.findByTenantIdAndDeletedFalse(caller.tenantId())
                .orElseGet(() -> {
                    TenantSettings blank = new TenantSettings();
                    blank.setTenantId(caller.tenantId());
                    return blank;
                });
    }

    // Look the caller's company up in the shared RegulaOne tenants collection (read-only).
    private Tenant loadTenant(AuthenticatedUser caller) {
        return tenantRepository.findById(caller.tenantId()).orElse(null);
    }

    // A flat snapshot of the human-meaningful fields, used to build the audit diff so the
    // trail shows what actually changed. Only the fields this API can change (DPO + AI).
    private static Map<String, Object> snapshot(TenantSettings s) {
        Map<String, Object> m = new LinkedHashMap<>();
        DpoDetails d = s.getDpo();
        AiPreferences ai = s.getAi();
        m.put("dpo.name", d == null ? null : d.getName());
        m.put("dpo.email", d == null ? null : d.getEmail());
        m.put("dpo.phone", d == null ? null : d.getPhone());
        m.put("dpo.appointedAt", d == null ? null : d.getAppointedAt());
        m.put("dpo.uodoNotifiedAt", d == null ? null : d.getUodoNotifiedAt());
        m.put("dpo.publishedOnWebsite", d != null && d.isPublishedOnWebsite());
        m.put("ai.enabled", ai != null && ai.isEnabled());
        m.put("ai.excludeSpecialCategories", ai != null && ai.isExcludeSpecialCategories());
        return m;
    }
}
