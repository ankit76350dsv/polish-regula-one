package com.privacypilot.backend.dto.settings;

import com.privacypilot.backend.model.embedded.AiPreferences;
import com.privacypilot.backend.model.embedded.DpoDetails;
import lombok.Data;

/**
 * The payload for saving a company's PrivacyPilot settings.
 *
 * It carries only the two groups PrivacyPilot actually owns — the DPO contact (and its
 * Art. 10/11 designation tracking) and the AI preferences. The company's LEGAL IDENTITY
 * is deliberately NOT here: it is owned and edited in RegulaOne (the shared tenant), so
 * this API can never change it. The server owns the base fields (id, tenantId,
 * timestamps, created/updated-by).
 *
 * Fields are intentionally NOT marked required: settings are filled in gradually, and
 * the notice/register completeness checks are what flag anything still missing.
 */
@Data
public class SettingsRequest {

    private DpoDetails dpo = new DpoDetails();
    private AiPreferences ai = new AiPreferences();
}
