package com.privacypilot.backend.model.embedded;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.bson.types.ObjectId;

/**
 * One risk line inside a DPIA. It records a possible harm, how the company will
 * reduce it, and the risk score BEFORE and AFTER those measures.
 *
 * Likelihood and severity are scored 1–5. Risk = likelihood × severity. The
 * "residual" numbers are the score that remains after the mitigation is applied
 * — GDPR cares most about that leftover risk (Art. 35(7)(c), Art. 36).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DpiaRisk {

    // WHAT: A unique id for this one risk line.
    // WHY: So the screen can edit or delete a single risk without touching the others.
    // EXAMPLE: an auto-generated value like "66f0a1c2...".
    private String id = new ObjectId().toHexString();

    // WHAT: A plain description of what could go wrong.
    // WHY: You must name the danger before you can measure or reduce it.
    // EXAMPLE: "Power imbalance pressures employees to hand over data."
    private String description;

    // WHAT: How LIKELY the danger is to happen, from 1 (rare) to 5 (very likely) —
    //       BEFORE any safeguards.
    // WHY: Half of the risk score. Bigger chance = bigger risk.
    // EXAMPLE: 3 (it could happen sometimes).
    private int likelihood;

    // WHAT: How BAD it would be if it happened, from 1 (minor) to 5 (severe) —
    //       BEFORE any safeguards.
    // WHY: The other half of the risk score. Worse harm = bigger risk.
    // EXAMPLE: 4 (serious harm to the person).
    private int severity;

    // The risk score is likelihood × severity (1–25). E.g. 3 × 4 = 12.

    // WHAT: What the company will do to reduce this risk (the safety step).
    // WHY: Finding a danger is not enough — you must show how you make it safer.
    // EXAMPLE: "Transparent policy, no covert processing, complaint channel."
    private String mitigation;

    // WHAT: How likely the danger is AFTER the safeguard is applied (1–5).
    // WHY: Proves the safety step actually lowered the chance of harm.
    // EXAMPLE: 2 (less likely now).
    private int residualLikelihood;

    // WHAT: How bad it would be AFTER the safeguard is applied (1–5).
    // WHY: Proves the safety step actually reduced the harm. The LEFTOVER score
    //      (residualLikelihood × residualSeverity) is what the law cares about most —
    //      if it stays high, prior consultation with UODO is needed (Art. 36).
    // EXAMPLE: 3 → residual score 2 × 3 = 6 (down from 12).
    private int residualSeverity;
}
