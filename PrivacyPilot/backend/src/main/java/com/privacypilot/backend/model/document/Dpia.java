package com.privacypilot.backend.model.document;

import com.privacypilot.backend.model.base.BaseDocument;
import com.privacypilot.backend.model.embedded.DpiaApproval;
import com.privacypilot.backend.model.embedded.DpiaRisk;
import com.privacypilot.backend.model.enums.dpia.DpiaCriterion;
import com.privacypilot.backend.model.enums.dpia.DpiaStatus;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.ArrayList;
import java.util.List;

/**
 * A Data Protection Impact Assessment (DPIA, Art. 35 GDPR). When a processing
 * activity is high-risk, the company must first write down: what it does, why it
 * is necessary, what could go wrong (the risks), how those risks are reduced,
 * and get it signed off. If high risk still remains, the company must consult
 * the authority first (Art. 36 "prior consultation").
 *
 * Each DPIA belongs to one processing activity via {@link #activityId}.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "privacypilot_dpias")
public class Dpia extends BaseDocument {

    // The id of the ProcessingActivity this assessment is for.
    @Indexed
    private String activityId;

    // A readable title for the assessment.
    private String title;

    // Draft / in progress / approved / rejected.
    private DpiaStatus status;

    // Which UODO screening criteria triggered this DPIA.
    private List<DpiaCriterion> criteriaMatched = new ArrayList<>();

    // A description of the processing being assessed (Art. 35(7)(a)).
    private String description;

    // Why the processing is necessary and proportionate (Art. 35(7)(b)).
    private String necessity;

    // The list of risks, each with a before/after score and a mitigation.
    private List<DpiaRisk> risks = new ArrayList<>();

    // The extra safeguards chosen to address the risks (Art. 35(7)(d)).
    private List<String> measures = new ArrayList<>();

    // The DPO's written opinion on the assessment (Art. 35(2)).
    private String dpoAdvice;

    // True if high risk remains and the authority (UODO) must be consulted first
    // under Art. 36 before processing can start.
    private boolean priorConsultation;

    // The sign-off lines (usually DPO and Company Admin).
    private List<DpiaApproval> approvals = new ArrayList<>();
}
