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

    // Short name of the activity, shown in the register list.
    private String name;

    // Is the company the controller (decides the purpose) or a processor (acts
    // for someone else)? This changes which other fields are required.
    private ProcessingRole role;

    // The department that owns this activity (HR, finance, etc.).
    private Department department;

    // Free-text name of the person responsible for the activity.
    private String ownerName;

    // Draft / in review / approved.
    private ActivityStatus status;

    // Why the data is used — the purpose of processing (Art. 30(1)(b)).
    private String purpose;

    // The Article 6 legal basis. May be empty for a processor activity, because a
    // processor relies on the controller's basis, not its own.
    private LawfulBasis lawfulBasis;

    // If the basis is "legitimate interest", this explains what that interest is.
    private String legitimateInterestDetail;

    // If special-category data is used, the Article 9(2) condition that allows it.
    // Null when no special data is involved.
    private Art9Condition art9Condition;

    // True if the activity involves criminal-offence data (Article 10).
    private boolean art10;

    // Which groups of people the data is about (employees, customers, ...).
    private List<DataSubjectCategory> dataSubjects = new ArrayList<>();

    // Which kinds of personal data are used (identity, health, ...).
    private List<DataCategory> dataCategories = new ArrayList<>();

    // Where the data comes from, in free text (e.g. "Directly from employees").
    private List<String> dataSources = new ArrayList<>();

    // The categories of outside parties the data is disclosed to (Art. 30(1)(d)).
    private List<RecipientCategory> recipients = new ArrayList<>();

    // Ids of the Vendor records (processors) used by this activity.
    private List<String> vendorIds = new ArrayList<>();

    // True if any data leaves the EEA under this activity.
    private boolean transfer;

    // Ids of the Transfer records that describe those international transfers.
    private List<String> transferIds = new ArrayList<>();

    // How long the data is kept, in plain words (Art. 30(1)(f) / 13(2)(a)).
    private String retentionPeriod;

    // The legal reason for that retention period (e.g. Labour Code article).
    private String retentionBasis;

    // The Article 32 security measures in place for this activity.
    private List<Tom> toms = new ArrayList<>();

    // Which UODO DPIA-screening criteria this activity matched.
    private List<DpiaCriterion> dpiaCriteria = new ArrayList<>();

    // The screening result: required / recommended / not indicated.
    private DpiaVerdict dpiaVerdict;

    // The id of the linked DPIA record, if one has been started. Null otherwise.
    private String dpiaId;

    // Text explaining whether giving the data is required by law/contract and what
    // happens if it is not given (Art. 13(2)(e)). Empty for processor activities.
    private String provisionStatement;

    // For a PROCESSOR activity only: a description of the controllers served
    // (Art. 30(2)(a)). Empty for controller activities.
    private String controllersServed;

    // The date this activity should next be reviewed for accuracy.
    private Instant reviewAt;
}
