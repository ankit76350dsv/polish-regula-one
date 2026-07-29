package com.privacypilot.backend.dto.dpia;

import com.privacypilot.backend.model.enums.dpia.DpiaStatus;
import jakarta.validation.Valid;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * The payload for EDITING the content of an existing DPIA (the four Art. 35(7)
 * sections plus the DPO advice and the Art. 36 flag).
 *
 * It carries ONLY the fields a user edits. It deliberately does NOT include:
 *   - activityId / title / criteriaMatched — set once from the linked activity;
 *   - approvals — changed only by signing (POST /{id}/sign), never by an edit;
 *   - the server-owned base fields (id, tenantId, timestamps, owner).
 *
 * The status here may move the DPIA between DRAFT / IN_PROGRESS / REJECTED. It can
 * NEVER be APPROVED through this path — approval happens only by all sign-off lines
 * being signed (the service ignores an APPROVED value sent here). Null status means
 * "leave the status as it is".
 */
@Data
public class DpiaUpdateRequest {

    // Art. 35(7)(a) — what the processing does.
    private String description;

    // Art. 35(7)(b) — why it is necessary and proportionate.
    private String necessity;

    // Art. 35(7)(c) — the risks, each validated to the 1–5 scale (see DpiaRiskRequest).
    // @Valid makes Bean Validation descend into each item.
    @Valid
    private List<DpiaRiskRequest> risks = new ArrayList<>();

    // Art. 35(7)(d) — the safeguards chosen to reduce the risks.
    private List<String> measures = new ArrayList<>();

    // Art. 35(2) — the DPO's written opinion.
    private String dpoAdvice;

    // Art. 36 — true if high risk remains, so UODO must be consulted first.
    private boolean priorConsultation;

    // DRAFT / IN_PROGRESS / REJECTED only (APPROVED is ignored here). Null = keep current.
    private DpiaStatus status;
}
