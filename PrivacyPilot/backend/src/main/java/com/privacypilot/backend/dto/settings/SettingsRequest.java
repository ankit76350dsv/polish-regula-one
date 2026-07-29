package com.privacypilot.backend.dto.settings;

import com.privacypilot.backend.model.embedded.AiPreferences;
import com.privacypilot.backend.model.embedded.CompanyDetails;
import com.privacypilot.backend.model.embedded.DpoDetails;
import lombok.Data;

/**
 * The payload for saving a company's PrivacyPilot settings.
 *
 * It carries the three editable groups — the company legal identity, the DPO contact
 * (and its Art. 10/11 designation tracking) and the AI preferences. The server owns
 * only the base fields (id, tenantId, timestamps, created/updated-by).
 *
 * Fields are intentionally NOT marked required: settings are filled in gradually, and
 * the notice/register completeness checks are what flag anything still missing (so a
 * half-filled company can still be saved without being blocked).
 */
@Data
public class SettingsRequest {

    private CompanyDetails company = new CompanyDetails();
    private DpoDetails dpo = new DpoDetails();
    private AiPreferences ai = new AiPreferences();
}
