package com.safevoice.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * The headline numbers shown on the staff dashboard's stat cards.
 *
 * Computed server-side (rather than in the browser) so the figures are accurate over
 * the WHOLE data set, not just the rows that happen to be loaded in the UI.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardStatsResponse {

    // Active cases that are not yet closed ("Open reports").
    private long openReports;

    // Messages from reporters that staff have not read yet ("Unread replies").
    private long unreadReplies;

    // Share of open cases still inside their feedback deadline, 0–100 ("Within SLA").
    // 100 when there are no open cases (nothing can be late).
    private int slaCompliancePercent;

    // Total sealed audit-trail entries for the tenant ("Audit entries sealed").
    private long auditEntries;
}
