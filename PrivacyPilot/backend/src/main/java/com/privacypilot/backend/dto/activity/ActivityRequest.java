package com.privacypilot.backend.dto.activity;

import com.privacypilot.backend.model.enums.activity.Art9Condition;
import com.privacypilot.backend.model.enums.activity.Department;
import com.privacypilot.backend.model.enums.activity.LawfulBasis;
import com.privacypilot.backend.model.enums.activity.ProcessingRole;
import com.privacypilot.backend.model.enums.dpia.DpiaCriterion;
import com.privacypilot.backend.model.enums.gdpr.DataCategory;
import com.privacypilot.backend.model.enums.gdpr.DataSubjectCategory;
import com.privacypilot.backend.model.enums.gdpr.RecipientCategory;
import com.privacypilot.backend.model.enums.gdpr.Tom;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * The payload for CREATING or UPDATING a processing activity (the ROPA form).
 *
 * It carries ONLY the fields a user fills in — never the server-owned ones (id,
 * tenantId, status, dpiaVerdict, dpiaId, timestamps, owner). Those are set by the
 * service from the session and business rules, so a client can never spoof them.
 * Enum fields accept the string codes (e.g. "controller"); an unknown code is
 * rejected as a 400 by the enum's own JsonCreator.
 */
@Data
public class ActivityRequest {

    // STEP 1 — basics
    @NotBlank(message = "name is required")
    private String name;
    private Department department;
    @NotNull(message = "role is required")
    private ProcessingRole role;
    private String controllersServed; // processor register only (Art. 30(2)(a))

    // STEP 2 — purpose & lawful basis
    private String purpose;
    private LawfulBasis lawfulBasis;
    private String legitimateInterestDetail;
    private String provisionStatement;

    // STEP 3 — data & subjects
    private List<DataSubjectCategory> dataSubjects = new ArrayList<>();
    private List<DataCategory> dataCategories = new ArrayList<>();
    private Art9Condition art9Condition;
    // True if criminal-conviction/offence data (Art. 10) is involved. The frontend sets
    // this from the ticked data categories.
    private boolean art10;
    private List<String> dataSources = new ArrayList<>();

    // STEP 4 — recipients & processors
    private List<RecipientCategory> recipients = new ArrayList<>();
    private List<String> vendorIds = new ArrayList<>();

    // STEP 5 — third-country transfers
    private boolean transfer;
    private List<String> transferIds = new ArrayList<>();

    // STEP 6 — retention
    private String retentionPeriod;
    private String retentionBasis;

    // STEP 7 — security measures (Art. 32)
    private List<Tom> toms = new ArrayList<>();

    // STEP 8 — DPIA screening. The service turns these criteria into the verdict; the
    // client never sends the verdict itself.
    private List<DpiaCriterion> dpiaCriteria = new ArrayList<>();
}
