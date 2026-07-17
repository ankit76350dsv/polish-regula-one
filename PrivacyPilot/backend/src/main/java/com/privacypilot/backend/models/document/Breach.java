package com.privacypilot.backend.model.document;

import com.privacypilot.backend.model.base.BaseDocument;
import com.privacypilot.backend.model.embedded.RemediationItem;
import com.privacypilot.backend.model.enums.breach.BreachStatus;
import com.privacypilot.backend.model.enums.common.RiskLevel;
import com.privacypilot.backend.model.enums.gdpr.DataCategory;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * A personal-data breach case (Art. 33–34 GDPR). When data is lost, leaked, or
 * exposed, the company records it here. If the breach is risky, it must tell the
 * authority (UODO) within 72 hours of becoming aware, and sometimes the affected
 * people too. Every breach is written down even when no notification is needed
 * (Art. 33(5) accountability).
 *
 * {@link #discoveredAt} is the moment the company became aware — it starts the
 * 72-hour notification clock.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "privacypilot_breaches")
public class Breach extends BaseDocument {

    // The fields below are ordered to MATCH the "Record breach" form, so reading
    // this class top-to-bottom follows the order a user fills the form in.
    // See BreachesPage.jsx.

    // ─────────────────────────────────────────────────────────────────────────
    // CAPTURED ON THE "RECORD BREACH" FORM
    // ─────────────────────────────────────────────────────────────────────────

    // WHAT: A short title for the incident, shown in the breach list.
    // WHY: So the team can recognise each breach at a glance.
    // EXAMPLE: "Lost laptop with HR spreadsheets".
    private String title;

    // WHAT: The risk to people's rights and freedoms — LOW / MEDIUM / HIGH.
    // WHY: The risk level decides the duties: risky → tell UODO; HIGH risk → also
    //      tell the affected people directly (Art. 34).
    // EXAMPLE: HIGH for leaked health data; LOW for a single wrong-address letter.
    private RiskLevel riskLevel;

    // WHAT: What happened, in plain words — the nature of the breach (Art. 33(3)(a)).
    // WHY: The UODO report and the audit trail need a clear account of the incident.
    // EXAMPLE: "An unencrypted laptop holding payroll spreadsheets was stolen from a car."
    private String description;

    // WHAT: Roughly how many PEOPLE are affected (Art. 33(3)(a)).
    // WHY: The UODO breach report asks for the approximate number of data subjects.
    // EXAMPLE: 1200 employees.
    private int subjectsCount;

    // WHAT: Roughly how many DATA RECORDS are affected (Art. 33(3)(a)).
    // WHY: The UODO breach report asks for BOTH the number of people AND the number
    //      of records — one person can have many records, so they are different.
    // EXAMPLE: 3500 payroll rows for those 1200 people.
    private int recordsCount;

    // WHAT: Which kinds of personal data were affected (one or more).
    // WHY: The report must state the categories of data involved (Art. 33(3)(a));
    //      sensitive categories raise the risk and the duty to notify people.
    // EXAMPLE: [IDENTITY, FINANCIAL, EMPLOYMENT] for a payroll leak.
    private List<DataCategory> dataCategories = new ArrayList<>();

    // WHAT: True if this breach must be reported to UODO (Art. 33(1)).
    // WHY: Drives the 72-hour notification clock shown on the page.
    // EXAMPLE: true for the stolen payroll laptop; false for a trivial, no-risk slip.
    private boolean uodoNotificationRequired;

    // WHAT: True if the affected PEOPLE must be told directly (Art. 34).
    // WHY: High-risk breaches require telling the individuals, not just the regulator.
    // EXAMPLE: true when leaked data could lead to identity theft.
    private boolean subjectsNotificationRequired;

    // WHAT: The written reasoning for the risk decision and the notify/don't-notify choice.
    // WHY: The law requires documenting the decision EVEN when you don't notify
    //      (Art. 33(5) accountability) — this is the record an auditor reads.
    // EXAMPLE: "Data was encrypted, so no real risk to individuals; UODO not notified."
    private String riskRationale;

    // ─────────────────────────────────────────────────────────────────────────
    // SET BY THE SYSTEM / LATER IN THE CASE (not typed on the form)
    // ─────────────────────────────────────────────────────────────────────────

    // WHAT: Where the case is — OPEN (still being handled) or CLOSED (fully dealt with).
    // WHY: Shows which breaches still need work vs. which are finished.
    // EXAMPLE: OPEN while notifying/fixing; CLOSED once everything is done.
    // NOTE: Starts as OPEN automatically when the breach is recorded.
    private BreachStatus status;

    // WHAT: The moment the company BECAME AWARE of the breach.
    // WHY: This starts the 72-hour clock to notify UODO (Art. 33(1)) — the single
    //      most important date on the whole record.
    // EXAMPLE: 2026-07-12T04:21:30Z.
    // NOTE: Currently set to "now" when the breach is recorded.
    private Instant discoveredAt;

    // WHAT: When UODO was ACTUALLY notified.
    // WHY: Proves the 72-hour duty was met, and when. Null = "not notified yet".
    // EXAMPLE: 2026-07-13T09:00:00Z.
    // NOTE: Set by the "mark notified" action, not typed on the form.
    private Instant uodoNotifiedAt;

    // WHAT: When the affected people were actually told directly (Art. 34).
    // WHY: Proves the Art. 34 duty was met, and when. Mirrors uodoNotifiedAt.
    // EXAMPLE: 2026-07-18. Null means "the people have not been told yet".
    // NOTE: Set by the "mark subjects notified" action, not typed on the form.
    private Instant subjectsNotifiedAt;

    // WHAT: The list of fix-it action items for this breach (embedded, not a separate
    //       collection). See RemediationItem.
    // WHY: Shows what the company did to contain the breach and stop it happening again.
    // EXAMPLE: [ "Enforce full-disk encryption", "Retrain staff on device security" ].
    private List<RemediationItem> remediation = new ArrayList<>();
}
