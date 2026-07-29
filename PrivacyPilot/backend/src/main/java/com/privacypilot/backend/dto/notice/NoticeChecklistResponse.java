package com.privacypilot.backend.dto.notice;

import java.util.List;

/**
 * The Art. 13/14 completeness check for one audience, computed from the REAL
 * register. It tells the UI whether a notice can be generated yet and, if not,
 * exactly which register facts are still missing.
 *
 * NOTE ON SCOPE: this checks only the items the server can verify from the
 * processing-activity register (purposes, lawful basis, retention, transfers,
 * provision requirement, data categories, sources). The "controller identity" and
 * "DPO contact" items depend on the company Settings, which are not yet a backend
 * feature, so they are handled on the client for now. The generate endpoint enforces
 * exactly the register-derived items below.
 *
 * @param audience      the audience code this checklist is for ("employees", …)
 * @param relevantCount how many register activities cover this audience
 * @param activityIds   the ids of those activities (the notice's future links)
 * @param checklist     one line per checked requirement
 * @param blocked       true if ANY line is not ok — generation must be refused
 */
public record NoticeChecklistResponse(
        String audience,
        int relevantCount,
        List<String> activityIds,
        List<Item> checklist,
        boolean blocked) {

    /**
     * One requirement line.
     *
     * @param id      a stable id ("purposes_basis", "retention", …) matching the UI
     * @param ref     the GDPR article reference, shown next to the label
     * @param ok      whether the register satisfies this requirement
     * @param details when not ok, a short hint of what is missing (else null)
     */
    public record Item(String id, String ref, boolean ok, String details) {
    }
}
