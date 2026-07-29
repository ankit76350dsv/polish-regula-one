package com.privacypilot.backend.model.document;

import com.privacypilot.backend.model.base.BaseDocument;
import com.privacypilot.backend.model.embedded.AiPreferences;
import com.privacypilot.backend.model.embedded.CompanyDetails;
import com.privacypilot.backend.model.embedded.DpoDetails;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * The PrivacyPilot settings for one company (tenant): its legal details, its
 * Data Protection Officer, and its AI-assistant preferences. There is exactly
 * ONE of these per tenant. Notices and the ROPA read from here to fill in the
 * "who is the controller" and "who is the DPO" parts.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "privacypilot_settings")
public class TenantSettings extends BaseDocument {

    // The company's legal identity details.
    private CompanyDetails company = new CompanyDetails();

    // The Data Protection Officer's details and UODO-notification tracking.
    private DpoDetails dpo = new DpoDetails();

    // The AI assistant preferences for this company.
    private AiPreferences ai = new AiPreferences();
}
