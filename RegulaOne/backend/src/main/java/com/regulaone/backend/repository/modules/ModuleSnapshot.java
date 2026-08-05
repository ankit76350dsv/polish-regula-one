package com.regulaone.backend.repository.modules;

import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.AttentionItem;
import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.Metric;

import java.util.List;

/**
 * What one module contributes to the company dashboard.
 *
 * Every module reader returns this same small pair, so the dashboard service can
 * treat all six modules identically:
 *
 *   metrics   — the facts shown on that module's card (counts, totals, dates).
 *   attention — the open legal obligations that belong in the shared
 *               "needs attention" list, already grouped into counts.
 *
 * Both lists hold aggregates only. No reader ever puts a person's name, contact
 * detail, health information or case content in here (GDPR Art. 5(1)(c) — only
 * the data actually needed for the purpose).
 */
public record ModuleSnapshot(List<Metric> metrics, List<AttentionItem> attention) {

    /** An empty snapshot — used when a module has nothing to report. */
    public static ModuleSnapshot empty() {
        return new ModuleSnapshot(List.of(), List.of());
    }
}
