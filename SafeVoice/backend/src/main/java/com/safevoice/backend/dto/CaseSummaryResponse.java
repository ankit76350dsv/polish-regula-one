package com.safevoice.backend.dto;

import com.safevoice.backend.model.enums.case_report.CaseSeverity;
import com.safevoice.backend.model.enums.case_report.CaseStatus;
import com.safevoice.backend.model.enums.case_report.DisclosureMode;
import com.safevoice.backend.model.enums.case_report.ReportCategory;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * A SLIM view of one case for the staff "case register" table.
 *
 * Why a separate, smaller object instead of the whole CaseReport:
 *  - The register only shows a handful of columns (reference, category, status,
 *    severity, investigator, feedback-due) plus an unread-message badge.
 *  - The full case document holds sensitive content — the encrypted description,
 *    the access-key fingerprint, the timeline, attachment metadata — none of which
 *    the list needs. Sending only this summary keeps that data off the wire for the
 *    list view (data minimisation, GDPR/RODO). The full case is fetched on its own,
 *    only when a staff member opens a single case.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CaseSummaryResponse {

    // The database id — used by the UI to open the full case ("Open" button).
    private String id;

    // The readable, non-secret handle shown in the table (e.g. "SV/2026/0629/1408").
    private String caseReference;

    // Anonymous / HR handoff, etc. — shown as a small label under the reference.
    private DisclosureMode disclosureMode;

    private ReportCategory category;

    private CaseStatus status;

    private CaseSeverity severity;

    // Who is handling the case ("Unassigned" / null when nobody is yet).
    private String assignedInvestigator;

    // The legal feedback deadline (3-month obligation), shown in the table.
    private Instant feedbackDue;

    // How many messages from the reporter the staff have not read yet. Drives the
    // unread badge in the register; 0 means nothing new.
    private long unreadCount;
}
