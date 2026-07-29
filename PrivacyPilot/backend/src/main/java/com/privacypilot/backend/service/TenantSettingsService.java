package com.privacypilot.backend.service;

import com.privacypilot.backend.dto.settings.SettingsRequest;
import com.privacypilot.backend.model.document.TenantSettings;
import com.privacypilot.backend.model.embedded.AiPreferences;
import com.privacypilot.backend.model.embedded.CompanyDetails;
import com.privacypilot.backend.model.embedded.DpoDetails;
import com.privacypilot.backend.model.enums.audit.AuditAction;
import com.privacypilot.backend.model.enums.audit.AuditEntityType;
import com.privacypilot.backend.repository.TenantSettingsRepository;
import com.privacypilot.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Business logic for a company's PrivacyPilot settings (company legal identity, DPO
 * contact + Art. 10/11 designation tracking, AI preferences).
 *
 * There is ONE settings document per tenant, so this is a read-one / upsert service
 * rather than a list/CRUD one. Everything is scoped to the caller's tenant.
 *
 * WHY this matters elsewhere: the ROPA register header (Art. 30(1)(a)) and every
 * privacy notice / breach report (Art. 13(1)(a)(b)) read the controller + DPO identity
 * from here. The DPO *permission* (who may act as DPO in the app) stays on the Users
 * page (RegulaOne RBAC); the DPO *contact* stored here is the published contact + the
 * designation paperwork, which is a separate, per-company compliance fact.
 */
@Service
@RequiredArgsConstructor
public class TenantSettingsService {

    private final TenantSettingsRepository repository;
    private final AuditService auditService;

    /**
     * The caller's company settings. If none have been saved yet, returns a fresh,
     * EMPTY settings object (with the tenant set) so the UI shows blank fields — it is
     * NOT persisted until the first save.
     */
    public TenantSettings get(AuthenticatedUser caller) {
        return repository.findByTenantIdAndDeletedFalse(caller.tenantId())
                .orElseGet(() -> {
                    TenantSettings blank = new TenantSettings();
                    blank.setTenantId(caller.tenantId());
                    return blank;
                });
    }

    /**
     * Save the company settings — UPSERT: updates the existing row, or creates it on
     * the first save. Records the change in the audit trail.
     */
    public TenantSettings update(AuthenticatedUser caller, SettingsRequest req, AuditContext ctx) {
        TenantSettings settings = repository.findByTenantIdAndDeletedFalse(caller.tenantId())
                .orElseGet(() -> {
                    TenantSettings fresh = new TenantSettings();
                    fresh.setTenantId(caller.tenantId());
                    return fresh;
                });

        Map<String, Object> before = snapshot(settings);

        // Apply the three groups, guarding against null so a partial payload can't wipe
        // a whole group to null (missing group → keep the current one).
        if (req.getCompany() != null) {
            settings.setCompany(req.getCompany());
        }
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
        String label = saved.getCompany() != null && saved.getCompany().getName() != null
                ? saved.getCompany().getName() : caller.tenantName();
        auditService.record(ctx, AuditAction.UPDATE, AuditEntityType.SETTINGS, saved.getId(), label,
                oldValue.isEmpty() ? null : oldValue, newValue.isEmpty() ? null : newValue);
        return saved;
    }

    // A flat snapshot of the human-meaningful fields, used to build the audit diff so
    // the trail shows what actually changed (e.g. "DPO email old → new").
    private static Map<String, Object> snapshot(TenantSettings s) {
        Map<String, Object> m = new LinkedHashMap<>();
        CompanyDetails c = s.getCompany();
        DpoDetails d = s.getDpo();
        AiPreferences ai = s.getAi();
        m.put("company.name", c == null ? null : c.getName());
        m.put("company.nip", c == null ? null : c.getNip());
        m.put("company.address", c == null ? null : c.getAddress());
        m.put("dpo.name", d == null ? null : d.getName());
        m.put("dpo.email", d == null ? null : d.getEmail());
        m.put("dpo.uodoNotifiedAt", d == null ? null : d.getUodoNotifiedAt());
        m.put("dpo.publishedOnWebsite", d != null && d.isPublishedOnWebsite());
        m.put("ai.enabled", ai != null && ai.isEnabled());
        m.put("ai.excludeSpecialCategories", ai != null && ai.isExcludeSpecialCategories());
        return m;
    }
}
