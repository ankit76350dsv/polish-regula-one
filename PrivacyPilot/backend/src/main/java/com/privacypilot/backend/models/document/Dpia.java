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

    // The fields below are ordered to MATCH the DPIA detail page, so reading this
    // class top-to-bottom follows the same order the page shows / a user fills.
    // See DpiaDetailPage.jsx.

    // ─────────────────────────────────────────────────────────────────────────
    // HEADER — which activity, name, status, and why this DPIA exists
    // ─────────────────────────────────────────────────────────────────────────

    // WHAT: The id of the ProcessingActivity (register entry) this DPIA is for.
    // WHY: A DPIA is always about ONE activity — this link ties the risk study to it.
    // EXAMPLE: the id of the "Kadry i płace (HR & payroll)" activity.
    @Indexed
    private String activityId;

    // WHAT: A short, readable name for this assessment, shown at the top of the page.
    // WHY: So people can recognise the DPIA in a list at a glance.
    // EXAMPLE: "DPIA — Kadry i płace (HR & payroll)".
    private String title;

    // WHAT: How finished this DPIA is — draft, in progress, approved, or rejected.
    // WHY: Only an APPROVED DPIA counts as done; the others mean work is still needed.
    // EXAMPLE: IN_PROGRESS while sections are still being filled in.
    private DpiaStatus status;

    // WHAT: Which UODO risk criteria triggered this DPIA (copied from the screening).
    // WHY: Shows WHY a DPIA was needed in the first place (the reason it was opened).
    // EXAMPLE: [VULNERABLE_SUBJECTS, GENETIC] for HR & payroll.
    private List<DpiaCriterion> criteriaMatched = new ArrayList<>();

    // ─────────────────────────────────────────────────────────────────────────
    // THE FOUR THINGS A DPIA MUST CONTAIN (Art. 35(7)(a)–(d)), in page order
    // ─────────────────────────────────────────────────────────────────────────

    // WHAT: A plain description of WHAT the processing does (Art. 35(7)(a)).
    // WHY: You can't judge if something is safe until you clearly say what it is.
    // EXAMPLE: "Employment contract performance, payroll, ZUS and tax settlements."
    private String description;

    // WHAT: WHY the processing is necessary and not excessive (Art. 35(7)(b)).
    // WHY: The law says only use the data you truly need — this proves you thought about it.
    // EXAMPLE: "Name, bank account and PESEL are required by law to run payroll and
    //          report to ZUS; nothing extra is collected."
    private String necessity;

    // WHAT: The list of risks — each with a description, a mitigation, and a
    //       before/after score (Art. 35(7)(c)). See DpiaRisk.
    // WHY: You must list what could go wrong before you can protect people from it.
    // EXAMPLE: one risk = "Power imbalance pressures employees", scored 3×4=12 → 2×3=6.
    private List<DpiaRisk> risks = new ArrayList<>();

    // WHAT: The extra safeguards chosen to reduce the risks (Art. 35(7)(d)).
    // WHY: Finding a danger is not enough — you must show what you will do about it.
    // EXAMPLE: ["Encryption at rest", "Need-to-know access", "Access logging"].
    private List<String> measures = new ArrayList<>();

    // ─────────────────────────────────────────────────────────────────────────
    // DPO ADVICE (Art. 35(2))
    // ─────────────────────────────────────────────────────────────────────────

    // WHAT: The DPO's written opinion on this DPIA (Art. 35(2)).
    // WHY: The law requires the company to seek the DPO's advice on the assessment.
    // EXAMPLE: "Risks are acceptable after the listed safeguards; no objection."
    private String dpoAdvice;

    // ─────────────────────────────────────────────────────────────────────────
    // PRIOR CONSULTATION (Art. 36)
    // ─────────────────────────────────────────────────────────────────────────

    // WHAT: True if HIGH RISK still remains after the safeguards, so the company must
    //       consult UODO before starting (Art. 36 "prior consultation").
    // WHY: This is the ONLY case where a DPIA must go to the government first.
    // EXAMPLE: true for large-scale sensitive-data processing with high leftover risk.
    // NOTE: Currently set by a person (a checkbox), not calculated automatically.
    private boolean priorConsultation;

    // ─────────────────────────────────────────────────────────────────────────
    // APPROVAL — the sign-off gate
    // ─────────────────────────────────────────────────────────────────────────

    // WHAT: The sign-off lines — usually one for the DPO and one for the Company Admin.
    // WHY: Two different people must approve, so no one can sign off a risky DPIA alone.
    //      The DPIA only becomes APPROVED when every line is signed. See DpiaApproval.
    // EXAMPLE: [ {DPO, pending}, {Company Admin, signed by Karolina Wójcik on 17/07/2026} ].
    private List<DpiaApproval> approvals = new ArrayList<>();
}
