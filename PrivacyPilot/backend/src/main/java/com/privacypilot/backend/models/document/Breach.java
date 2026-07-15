package com.privacypilot.backend.model.document;

import com.privacypilot.backend.model.base.BaseDocument;
import com.privacypilot.backend.model.embedded.RemediationItem;
import com.privacypilot.backend.model.enums.breach.BreachStatus;
import com.privacypilot.backend.model.enums.common.RiskLevel;
import com.privacypilot.backend.model.enums.gdpr.DataCategory;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * A personal-data breach case (Art. 33–34 GDPR). When data is lost, leaked, or
 * exposed, the company records it here. If the breach is risky, it must tell the
 * authority (UODO) within 72 hours of becoming aware, and sometimes the affected
 * people too. Every breach is written down even when no notification is needed
 * (Art. 33(5) accountability).
 *
 * {@link #discoveredAt} is the moment the company became aware — it starts the
 * 72-hour notification clock.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "privacypilot_breaches")
public class Breach extends BaseDocument {

    // Short title of the incident.
    private String title;

    // Open (still handling) or closed (fully dealt with).
    private BreachStatus status;

    // When the company became aware of the breach. Starts the 72-hour clock.
    private Instant discoveredAt;

    // What happened, in plain words.
    private String description;

    // Which kinds of personal data were affected.
    private List<DataCategory> dataCategories = new ArrayList<>();

    // Roughly how many people are affected.
    private int subjectsCount;

    // The risk to people's rights and freedoms (low / medium / high).
    private RiskLevel riskLevel;

    // True if the breach must be reported to UODO (Art. 33(1)).
    private boolean uodoNotificationRequired;

    // When UODO was actually notified. Null means "not notified yet".
    private Instant uodoNotifiedAt;

    // True if the affected people must be told directly (Art. 34).
    private boolean subjectsNotificationRequired;

    // The written reasoning for the risk decision and notification choices. This
    // is the accountability record an auditor will read.
    private String riskRationale;

    // The list of fix-it action items for this breach.
    private List<RemediationItem> remediation = new ArrayList<>();
}
