package com.privacypilot.backend.model.document;

import com.privacypilot.backend.model.base.BaseDocument;
import com.privacypilot.backend.model.enums.common.RiskLevel;
import com.privacypilot.backend.model.enums.vendor.DpaStatus;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * An outside supplier that processes the company's data on its behalf (a
 * "processor" under Art. 28 GDPR) — for example an ERP provider or a mailing
 * tool. The company must have a signed Data Processing Agreement (DPA) with each
 * one, and should review them regularly.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "privacypilot_vendors")
public class Vendor extends BaseDocument {

    // The supplier's name.
    private String name;

    // The country the supplier is based in.
    private String country;

    // A human-friendly note about WHERE the data actually sits (e.g. the data
    // centre region), which matters for EEA data-residency checks.
    private String region;

    // Whether the DPA is signed, being negotiated, or missing.
    private DpaStatus dpaStatus;

    // Any sub-processors this supplier uses (Art. 28(2)/(4)).
    private List<String> subprocessors = new ArrayList<>();

    // The overall risk rating for this supplier.
    private RiskLevel riskLevel;

    // When the supplier was last reviewed. Null means "never reviewed yet".
    private Instant lastReviewAt;
}
