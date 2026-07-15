package com.privacypilot.backend.model.document;

import com.privacypilot.backend.model.base.BaseDocument;
import com.privacypilot.backend.model.enums.activity.ActivityStatus;
import com.privacypilot.backend.model.enums.activity.Art9Condition;
import com.privacypilot.backend.model.enums.activity.Department;
import com.privacypilot.backend.model.enums.activity.LawfulBasis;
import com.privacypilot.backend.model.enums.activity.ProcessingRole;
import com.privacypilot.backend.model.enums.dpia.DpiaCriterion;
import com.privacypilot.backend.model.enums.dpia.DpiaVerdict;
import com.privacypilot.backend.model.enums.gdpr.DataCategory;
import com.privacypilot.backend.model.enums.gdpr.DataSubjectCategory;
import com.privacypilot.backend.model.enums.gdpr.RecipientCategory;
import com.privacypilot.backend.model.enums.gdpr.Tom;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * A single entry in the Record of Processing Activities (the "ROPA", required by
 * Art. 30 GDPR). Each entry describes ONE thing the company does with personal
 * data — for example "HR & payroll" or "CCTV monitoring" — and captures every
 * detail the law says a register must contain.
 *
 * This is the heart of PrivacyPilot: DPIAs, privacy notices, vendor links and
 * transfer links all hang off these activity records.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "privacypilot_activities")
public class ProcessingActivity extends BaseDocument {

    // WHAT: A short name for this activity, shown in the register list.
    // WHY: So people can tell one activity apart from another at a glance.
    // EXAMPLE: "Kadry i płace (HR & payroll)" or "Newsletter marketingowy".
    private String name;

    // WHAT: Is the company the CONTROLLER (it decides why the data is used) or a
    //       PROCESSOR (it only handles data for another company)?
    // WHY: The law keeps two different registers (Art. 30(1) and 30(2)), and this
    //      choice changes which other fields are required.
    // EXAMPLE: CONTROLLER for our own HR data; PROCESSOR if we run payroll for a client.
    private ProcessingRole role;

    // WHAT: The team inside the company that owns this activity.
    // WHY: So an auditor knows who is responsible for it.
    // EXAMPLE: HR, FINANCE, MARKETING, SECURITY.
    private Department department;

    // WHAT: The name of the person responsible for this activity (free text).
    // WHY: A named owner makes the record accountable and easy to follow up.
    // EXAMPLE: "Anna Kowalska".
    private String ownerName;

    // WHAT: How finished the record is — draft, in review, or approved.
    // WHY: Only approved entries count as real, signed-off register records.
    // EXAMPLE: DRAFT while being written, APPROVED after the DPO signs off.
    private ActivityStatus status;

    // WHAT: Why the data is used — the purpose of the processing (Art. 30(1)(b)).
    // WHY: The register must state the reason for every use of personal data.
    // EXAMPLE: "Sending monthly marketing newsletters to people who subscribed."
    private String purpose;

    // WHAT: The Article 6 legal reason that ALLOWS this processing (pick one).
    // WHY: You may not use personal data without a lawful basis — this proves you have one.
    // EXAMPLE: CONSENT for a newsletter; LEGAL_OBLIGATION for payroll.
    // NOTE: May be empty for a PROCESSOR, because it relies on the controller's basis.
    private LawfulBasis lawfulBasis;

    // WHAT: If the basis is "legitimate interest", a sentence explaining that interest.
    // WHY: The law (Art. 13(1)(d)) requires you to say WHAT the interest is.
    // EXAMPLE: "Protecting company property and staff safety using CCTV."
    private String legitimateInterestDetail;

    // WHAT: If sensitive (special-category) data is used, the Art. 9(2) condition
    //       that makes it allowed.
    // WHY: Sensitive data (health, religion, etc.) is extra-protected and needs a
    //      specific legal condition. Null when no sensitive data is involved.
    // EXAMPLE: EMPLOYMENT_SOCIAL_SECURITY_LAW for health data kept in HR files.
    private Art9Condition art9Condition;

    // WHAT: True if this activity uses criminal-conviction / offence data (Art. 10).
    // WHY: Criminal data has special rules; this flag is set automatically when the
    //      "criminal" data category is chosen.
    // EXAMPLE: true for a background-check activity; false for a newsletter.
    private boolean art10;

    // WHAT: WHICH GROUPS OF PEOPLE the data is about (one or more).
    // WHY: The register must record whose data is processed (Art. 30(1)(c)).
    // EXAMPLE: [EMPLOYEES], or [CUSTOMERS, WEBSITE_USERS].
    private List<DataSubjectCategory> dataSubjects = new ArrayList<>();

    // WHAT: WHICH KINDS OF DATA are used (one or more).
    // WHY: The register must list the categories of personal data (Art. 30(1)(c)).
    // EXAMPLE: [IDENTITY, CONTACT, FINANCIAL] for payroll; [CONTACT] for a newsletter.
    private List<DataCategory> dataCategories = new ArrayList<>();

    // WHAT: Where the data comes from, written in plain words (one or more lines).
    // WHY: Helps prove the data was collected fairly and lawfully.
    // EXAMPLE: ["Directly from employees", "ZUS / medical providers"].
    private List<String> dataSources = new ArrayList<>();

    // WHAT: The categories of OUTSIDE PARTIES the data is shared with (Art. 30(1)(d)).
    // WHY: People have a right to know who else receives their data.
    // EXAMPLE: [PUBLIC_AUTHORITIES, BANKS] for payroll.
    private List<RecipientCategory> recipients = new ArrayList<>();

    // WHAT: The ids of the Vendor records (processors) that handle this data for us.
    // WHY: Links the activity to the specific suppliers we have Art. 28 contracts with.
    // EXAMPLE: ["vendor-mailchimp-id"] for a newsletter run through Mailchimp.
    private List<String> vendorIds = new ArrayList<>();

    // WHAT: True if any data leaves the EEA (goes to a country outside Europe).
    // WHY: Sending data abroad is restricted and must be flagged and justified.
    // EXAMPLE: true if the mailing tool stores data in the USA; false if all stays in the EU.
    private boolean transfer;

    // WHAT: The ids of the Transfer records that describe those out-of-EEA transfers.
    // WHY: Each transfer needs its own record showing the country and the safeguard.
    // EXAMPLE: ["transfer-usa-scc-id"]. Empty when transfer is false.
    private List<String> transferIds = new ArrayList<>();

    // WHAT: How long the data is kept, in plain words (Art. 30(1)(f) / 13(2)(a)).
    // WHY: The law says data must not be kept longer than needed — this states the limit.
    // EXAMPLE: "10 years after employment ends" or "Until consent is withdrawn".
    private String retentionPeriod;

    // WHAT: The legal reason behind that retention period.
    // WHY: Shows the retention time is based on a real rule, not a guess.
    // EXAMPLE: "Art. 94 pkt 9b Kodeksu pracy (personnel files)".
    private String retentionBasis;

    // WHAT: The Article 32 security measures protecting this data (one or more).
    // WHY: The law requires appropriate protection; this lists what is in place.
    // EXAMPLE: [ENCRYPTION_TRANSIT, ACCESS_CONTROL, DPA_CONTRACTS].
    private List<Tom> toms = new ArrayList<>();

    // WHAT: Which UODO risk criteria this activity matched during DPIA screening.
    // WHY: The number of matched criteria decides if a deep risk study is needed.
    // EXAMPLE: [SYSTEMATIC_MONITORING, VULNERABLE_SUBJECTS] for CCTV.
    private List<DpiaCriterion> dpiaCriteria = new ArrayList<>();

    // WHAT: The screening result, decided automatically from the criteria above.
    // WHY: Tells the company whether a DPIA is required, recommended, or not needed.
    // EXAMPLE: REQUIRED for CCTV; NOT_INDICATED for a simple newsletter.
    private DpiaVerdict dpiaVerdict;

    // WHAT: The id of the linked DPIA record, if a risk study has been started.
    // WHY: Connects this activity to its full DPIA document. Null if none yet.
    // EXAMPLE: "dpia-001" once a DPIA is created for the activity.
    private String dpiaId;

    // WHAT: Text saying whether giving the data is required by law/contract and what
    //       happens if the person does not give it (Art. 13(2)(e)).
    // WHY: People must be told if providing data is mandatory and the consequences.
    // EXAMPLE: "Required by the Labour Code; without it we cannot run payroll."
    // NOTE: Empty for a PROCESSOR activity.
    private String provisionStatement;

    // WHAT: For a PROCESSOR activity only — a description of the controllers we work
    //       for (Art. 30(2)(a)).
    // WHY: A processor's register must say whose data it is handling.
    // EXAMPLE: "Payroll processing on behalf of Acme Sp. z o.o."
    // NOTE: Empty for a CONTROLLER activity.
    private String controllersServed;

    // WHAT: The date this activity should next be checked for accuracy.
    // WHY: Registers must stay up to date; this schedules the next review.
    // EXAMPLE: one year from the last edit.
    private Instant reviewAt;
}
