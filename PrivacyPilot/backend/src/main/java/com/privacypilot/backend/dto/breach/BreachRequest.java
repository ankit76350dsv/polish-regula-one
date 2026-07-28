package com.privacypilot.backend.dto.breach;

import com.privacypilot.backend.model.enums.breach.BreachStatus;
import com.privacypilot.backend.model.enums.common.RiskLevel;
import com.privacypilot.backend.model.enums.gdpr.DataCategory;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * The payload for RECORDING or UPDATING a personal-data breach (Art. 33–34 GDPR).
 *
 * It carries the fields a user fills in on the "Record breach" form, plus the two
 * fields the case-work screen edits (status and the remediation list). The server
 * owns id, tenantId, the timestamps, and the two "notified at" moments — those are
 * set only by the dedicated notify actions, never through this request. So an
 * ordinary edit can never fake "we told UODO".
 *
 * discoveredAt is OPTIONAL: it is when the company became AWARE (which may be earlier
 * than recording). The service defaults it to "now" on create when it is not sent.
 * status is OPTIONAL: create always starts a breach OPEN; an update may set OPEN/CLOSED.
 */
@Data
public class BreachRequest {

    @NotBlank(message = "title is required")
    private String title;

    // The risk to people's rights and freedoms — decides the notification duties.
    @NotNull(message = "riskLevel is required")
    private RiskLevel riskLevel;

    @NotBlank(message = "description is required")
    private String description;

    // Approximate number of people / records affected (Art. 33(3)(a)).
    @Min(value = 0, message = "subjectsCount cannot be negative")
    private int subjectsCount;

    @Min(value = 0, message = "recordsCount cannot be negative")
    private int recordsCount;

    // Which kinds of personal data were affected.
    private List<DataCategory> dataCategories = new ArrayList<>();

    // Whether UODO must be told (drives the 72-hour clock) / whether the people must be told.
    private boolean uodoNotificationRequired;
    private boolean subjectsNotificationRequired;

    // The written reasoning behind the risk + notify decision — required even when NOT
    // notifying (Art. 33(5) accountability).
    @NotBlank(message = "riskRationale is required")
    private String riskRationale;

    // When the company became aware (starts the 72h clock). Optional; defaults to now.
    private Instant discoveredAt;

    // OPEN / CLOSED. Optional — create forces OPEN; update may change it.
    private BreachStatus status;

    // The fix-it action list; each item's text is validated (see RemediationItemRequest).
    @Valid
    private List<RemediationItemRequest> remediation = new ArrayList<>();
}
