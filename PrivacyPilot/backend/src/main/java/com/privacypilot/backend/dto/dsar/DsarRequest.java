package com.privacypilot.backend.dto.dsar;

import com.privacypilot.backend.model.enums.dsar.DsarType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * The payload for RECORDING (intake) or UPDATING a data-subject request.
 *
 * The server owns the lifecycle fields — status, the deadline (dueAt), extended /
 * extensionReason, completedAt and the refusal fields — so those are NOT here; they
 * change only through the dedicated actions (extend / complete / refuse). identity
 * verification and the collection-task list DO come through here (a normal update).
 *
 * receivedAt is OPTIONAL: it is what STARTS the one-month clock, so the service defaults
 * it to "now" on create when it is not sent. It is used on create only — the deadline is
 * then fixed (and only moves via the extend action), so an ordinary update ignores it.
 */
@Data
public class DsarRequest {

    @NotNull(message = "type is required")
    private DsarType type;

    @NotBlank(message = "requesterName is required")
    private String requesterName;

    private String requesterEmail;
    private String relation;

    // When the request was received (start of the 1-month clock). Optional; create
    // defaults it to now. Ignored on update (the deadline is fixed after create).
    private Instant receivedAt;

    private String notes;

    // Identity check (Art. 12(6)). On create the server always starts this false (a
    // request is never auto-verified); on update this is how "verify identity" is set.
    private boolean identityVerified;
    private String identityMethod;

    // The collection-work checklist; each task's text is validated (see DsarTaskRequest).
    @Valid
    private List<DsarTaskRequest> tasks = new ArrayList<>();
}
