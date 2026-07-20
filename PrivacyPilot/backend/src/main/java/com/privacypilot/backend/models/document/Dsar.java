package com.privacypilot.backend.model.document;

import com.privacypilot.backend.model.base.BaseDocument;
import com.privacypilot.backend.model.embedded.DsarTask;
import com.privacypilot.backend.model.enums.dsar.DsarStatus;
import com.privacypilot.backend.model.enums.dsar.DsarType;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * A Data Subject Access Request ("DSAR") — one record for each time a person
 * exercises one of their GDPR rights (Chapter III, Arts. 15–22), such as asking
 * for a copy of their data (Art. 15) or asking to delete it (Art. 17).
 *
 * The company MUST answer within one month of receiving the request (Art. 12(3)).
 * That one month can be extended by two more months for complex requests, but
 * only if the person is told about the delay within the first month.
 *
 * This is the heart of the DSAR module: a request is created from the "Record
 * request" form, then worked through on its own page — verify identity, tick off
 * the collection tasks, and finally complete or refuse it — all before the
 * deadline the app watches in {@link #dueAt} so a request is never missed.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "privacypilot_dsars")
public class Dsar extends BaseDocument {

    // The fields below follow the ORDER a request is actually handled: first the
    // intake form that logs it (DsarPage.jsx "Record request"), then the steps on
    // the detail page that work it to a close (DsarDetailPage.jsx).

    // ─────────────────────────────────────────────────────────────────────────
    // INTAKE — filled from the "Record request" form when the request arrives
    // ─────────────────────────────────────────────────────────────────────────

    // WHAT: Which right the person is exercising (access, erasure, portability, ...).
    // WHY: Each right has different rules, so we must record exactly which one it is.
    // EXAMPLE: ACCESS (Art. 15) for "send me a copy of my data".
    private DsarType type;

    // WHAT: The name the requester gave.
    // WHY: So the team knows whose request this is and can address the reply.
    // EXAMPLE: "Tomasz Mazur".
    private String requesterName;

    // WHAT: The requester's e-mail address.
    // WHY: Used both to confirm who they are and to send the answer back to them.
    // EXAMPLE: "tomasz.mazur@example.com".
    private String requesterEmail;

    // WHAT: How the requester relates to the company, in plain words.
    // WHY: Helps find their data and judge the request (an ex-employee vs a customer).
    // EXAMPLE: "Former employee", "Newsletter subscriber", "Customer".
    private String relation;

    // WHAT: The date the request was received.
    // WHY: This is what STARTS the one-month clock, so the deadline is correct even
    //      when a request is logged a few days after it actually came in.
    // EXAMPLE: 25/06/2026.
    //! NOTE: If left blank on the form, the service defaults it to "now".
    private Instant receivedAt;

    // WHAT: Free-text working notes about the request.
    // WHY: A place for the handler to jot context that has no dedicated field.
    // EXAMPLE: "Requester also phoned to confirm; see call log."
    private String notes;

    // ─────────────────────────────────────────────────────────────────────────
    // IDENTITY VERIFICATION — done on the detail page before any data is released
    // ─────────────────────────────────────────────────────────────────────────

    // WHAT: True once we are sure the requester really is the person they claim.
    // WHY: We must confirm identity before handing over personal data (Art. 12(6)),
    //      otherwise we could leak someone's data to an impostor. A request cannot
    //      be completed until this is true.
    // EXAMPLE: false while pending, true after the check is confirmed by a human.
    private boolean identityVerified;

    // WHAT: How the identity was confirmed, in plain words.
    // WHY: Records HOW we checked — and proves we kept the check proportionate, since
    //      UODO (the Polish authority) has fined companies for demanding too much ID.
    // EXAMPLE: "Reply from the e-mail address on file + employee ID number".
    private String identityMethod;

    // ─────────────────────────────────────────────────────────────────────────
    // COLLECTION WORK — the to-do list worked through on the detail page
    // ─────────────────────────────────────────────────────────────────────────

    // WHAT: The list of to-do items needed to fulfil this request.
    // WHY: Ticking these off is the evidence that the work was actually done before
    //      the deadline. Stored INSIDE this record (embedded), not in a separate
    //      collection, because a task has no meaning without its parent request.
    // EXAMPLE: ["Export personnel file (Comarch Optima)", "Prepare Art. 15 letter"].
    private List<DsarTask> tasks = new ArrayList<>();

    // ─────────────────────────────────────────────────────────────────────────
    // DEADLINE & LIFECYCLE — set by the system and the extend/complete actions
    // ─────────────────────────────────────────────────────────────────────────

    // WHAT: The date the answer is due by (one month, or three if extended).
    // WHY: This is the single deadline the whole app watches and counts down.
    // EXAMPLE: 25/07/2026 (one month after a 25/06/2026 receipt).
    //! NOTE: Calculated from receivedAt; not typed by hand.
    private Instant dueAt;

    // WHAT: True if the one-month deadline has been extended by two more months.
    // WHY: Records that we lawfully used the Art. 12(3) extension for a hard case.
    // EXAMPLE: true after the "Extend" action is used.
    private boolean extended;

    // WHAT: The reason the deadline was extended.
    // WHY: The law only allows an extension for complex/numerous requests, and the
    //      person must be told why — this stores that mandatory justification.
    // EXAMPLE: "Large personnel file across three archived systems."
    //! NOTE: Required when extended is true; empty otherwise.
    private String extensionReason;

    // WHAT: The progress of the request — in progress, completed, or refused.
    // WHY: Drives what the handler can still do and whether the deadline still counts.
    // EXAMPLE: IN_PROGRESS while being worked on, COMPLETED once answered.
    //! NOTE: Starts as IN_PROGRESS; changed by the complete/refuse actions.
    private DsarStatus status;

    // WHAT: The moment the request was finished.
    // WHY: Proves we answered, and when — useful evidence during an audit.
    // EXAMPLE: set to the completion time; null until the request is finished.
    private Instant completedAt;
}
