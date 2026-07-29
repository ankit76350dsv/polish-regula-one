package com.privacypilot.backend.dto.dashboard;

import com.privacypilot.backend.dto.audit.AuditEntryResponse;

import java.util.List;

/**
 * Everything the compliance dashboard shows, in ONE response.
 *
 * WHY one combined shape: the dashboard used to pull five separate lists into the
 * browser and add them up there. That meant five network calls and browser-side
 * deadline maths that could drift from the server's. Now the server does the counting
 * and the deadline clocks (72h breach window, DSAR due date) once, authoritatively, and
 * hands back just the small numbers the screen paints — nothing sensitive, no full lists.
 *
 * Every number is a plain fact (a count or a deadline), never a made-up "compliance score".
 */
public record DashboardResponse(

        // The four headline cards at the top.
        Counts counts,

        // The register broken down two ways for the bar charts. Each entry is an enum
        // CODE ("HR", "CONSENT", …) plus how many activities fall in it; the frontend
        // turns the code into a translated label.
        List<GroupCount> byDepartment,
        List<GroupCount> byBasis,

        // The "needs attention" list — only things with a real deadline or a real gap.
        List<AttentionItem> attention,

        // The most recent audit lines (accountability, Art. 5(2)), newest first.
        List<AuditEntryResponse> recentAudit) {

    /** The headline numbers shown on the four stat cards. */
    public record Counts(
            // ROPA: how many live activities are in the register (Art. 30).
            int ropaActive,
            // DPIA: how many are being worked on, and how many activities still NEED one.
            int dpiaInProgress,
            int dpiaRequired,
            // Breaches: how many are open, and how many are still inside the 72h UODO
            // window and not yet notified (Art. 33).
            int breachesOpen,
            int breachesWithin72h,
            // DSARs: how many are still being handled, and how many are due within 7 days.
            int dsarsOpen,
            int dsarsUrgent) {
    }

    /** One bar in a chart: a category code and its count. */
    public record GroupCount(String key, int count) {
    }

    /**
     * One row in the "needs attention" list. It is structured (not pre-written text) so
     * the frontend can show it in Polish or English and colour it by {@code tone}.
     *
     * type  — what kind of item (BREACH_72H, DSAR_URGENT, DPIA_REQUIRED,
     *         PRIOR_CONSULTATION, VENDOR_DPA_MISSING).
     * id    — the record's id (for the deep link).
     * to    — the relative route to open it (the frontend prefixes the company base).
     * label — the record's name/title to show.
     * tone  — RISK (red) or WARN (amber).
     * daysLeft — only for DSARs: days until the legal deadline (negative = overdue).
     */
    public record AttentionItem(
            String type,
            String id,
            String to,
            String label,
            String tone,
            Integer daysLeft) {
    }
}
