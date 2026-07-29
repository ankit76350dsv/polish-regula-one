package com.privacypilot.backend.dto.dpia;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * One risk line inside a DPIA, as sent by the client (Art. 35(7)(c)).
 *
 * WHY a request DTO (not the embedded {@code DpiaRisk} directly): the stored model
 * carries no validation, but a legally-defensible risk score must be in range. So
 * this DTO enforces the 1–5 scale on every score BEFORE it is saved. The service
 * maps it to the embedded {@code DpiaRisk} (keeping the id when the client sends one,
 * otherwise generating a fresh one).
 */
@Data
public class DpiaRiskRequest {

    // Optional: present when the client is editing an existing risk line, absent
    // (null) for a brand-new one. The service generates an id when it is null.
    private String id;

    @NotBlank(message = "risk description is required")
    private String description;

    // Score BEFORE the safeguard — likelihood and severity, each on a 1–5 scale.
    @Min(value = 1, message = "likelihood must be 1–5")
    @Max(value = 5, message = "likelihood must be 1–5")
    private int likelihood;

    @Min(value = 1, message = "severity must be 1–5")
    @Max(value = 5, message = "severity must be 1–5")
    private int severity;

    private String mitigation;

    // Score AFTER the safeguard — the leftover ("residual") risk the law cares about.
    @Min(value = 1, message = "residualLikelihood must be 1–5")
    @Max(value = 5, message = "residualLikelihood must be 1–5")
    private int residualLikelihood;

    @Min(value = 1, message = "residualSeverity must be 1–5")
    @Max(value = 5, message = "residualSeverity must be 1–5")
    private int residualSeverity;
}
