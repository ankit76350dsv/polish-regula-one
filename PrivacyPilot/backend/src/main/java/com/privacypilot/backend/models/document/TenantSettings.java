package com.privacypilot.backend.model.document;

import com.privacypilot.backend.model.base.BaseDocument;
import com.privacypilot.backend.model.embedded.AiPreferences;
import com.privacypilot.backend.model.embedded.DpoDetails;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * The PrivacyPilot-specific settings for one company (tenant): its Data
 * Protection Officer contact + Art. 10/11 designation tracking, and its
 * AI-assistant preferences. There is exactly ONE of these per tenant.
 *
 * NOTE: the company's LEGAL IDENTITY (name, NIP, REGON, address, …) is NOT kept
 * here anymore. RegulaOne is the single source of truth for it — it owns the
 * shared "tenants" collection and its own company-profile page edits it. This
 * document holds only the two things that are genuinely PrivacyPilot's own:
 * the DPO record (a GDPR/Polish compliance fact this module tracks) and the AI
 * preferences (a feature toggle for this module). The company identity is read
 * from the Tenant and merged in by {@code TenantSettingsService} for callers.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "privacypilot_settings")
public class TenantSettings extends BaseDocument {

    // The Data Protection Officer's details and UODO-notification tracking.
    private DpoDetails dpo = new DpoDetails();

    // The AI assistant preferences for this company.
    private AiPreferences ai = new AiPreferences();
}
