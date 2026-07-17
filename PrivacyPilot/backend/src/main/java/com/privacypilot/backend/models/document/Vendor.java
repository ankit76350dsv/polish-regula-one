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

    // WHAT: The supplier's name.
    // WHY: So the company can identify which outside party handles its data.
    // EXAMPLE: "Mailchimp" or "Comarch ERP".
    private String name;

    // WHAT: The country the supplier is based in.
    // WHY: Helps judge whether data may leave the EEA (see Transfers).
    // EXAMPLE: "Poland", "Germany", "USA".
    private String country;

    // WHAT: A plain note about WHERE the data actually sits (e.g. the data-centre
    //       region), which can differ from the head-office country.
    // WHY: Data must stay in the EEA by default — the real storage region is what
    //      matters for that residency check, not the company's address.
    // EXAMPLE: "AWS eu-central-1 (Frankfurt)".
    private String region;

    // WHAT: Whether the Data Processing Agreement (Art. 28 contract) is in place.
    // WHY: You may only use a processor under a signed DPA — a MISSING one is a real
    //      compliance gap, shown in red on the page.
    // EXAMPLE: SIGNED / IN_NEGOTIATION / MISSING.
    private DpaStatus dpaStatus;

    // WHAT: The other suppliers this vendor uses under the hood (Art. 28(2)/(4)).
    // WHY: Sub-processors also touch your data, so they must be known and covered.
    // EXAMPLE: ["Amazon Web Services", "SendGrid"].
    private List<String> subprocessors = new ArrayList<>();

    // WHAT: The overall risk rating for this supplier.
    // WHY: Helps prioritise which vendors to review and watch most closely.
    // EXAMPLE: LOW / MEDIUM / HIGH.
    private RiskLevel riskLevel;

    // WHAT: When the supplier was last reviewed.
    // WHY: Processors must be reviewed regularly; a blank value flags "never reviewed".
    // EXAMPLE: 2026-01-15. Null means it has never been reviewed yet.
    private Instant lastReviewAt;
}
