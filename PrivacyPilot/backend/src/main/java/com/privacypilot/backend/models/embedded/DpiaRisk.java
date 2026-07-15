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

    // A unique id for this risk line, so the UI can edit/delete a single one.
    private String id = new ObjectId().toHexString();

    // Plain description of what could go wrong.
    private String description;

    // How likely it is, from 1 (rare) to 5 (very likely) — before mitigation.
    private int likelihood;

    // How bad it would be, from 1 (minor) to 5 (severe) — before mitigation.
    private int severity;

    // What the company will do to reduce this risk.
    private String mitigation;

    // How likely it is AFTER the mitigation (1–5).
    private int residualLikelihood;

    // How bad it would be AFTER the mitigation (1–5).
    private int residualSeverity;
}
