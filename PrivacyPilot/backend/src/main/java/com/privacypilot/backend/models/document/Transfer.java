package com.privacypilot.backend.model.document;

import com.privacypilot.backend.model.base.BaseDocument;
import com.privacypilot.backend.model.enums.gdpr.TransferMechanism;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * A record of personal data being sent OUTSIDE the EEA (GDPR Chapter V). For
 * each transfer the register must show the destination country, who receives
 * the data, and the legal tool that makes the transfer safe (an adequacy
 * decision, Standard Contractual Clauses, etc.).
 *
 * A transfer can be linked to a vendor and/or to a processing activity.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "privacypilot_transfers")
public class Transfer extends BaseDocument {

    // WHAT: The id of the Vendor (supplier) this transfer goes through, if any.
    //       Holds the `_id` of a document in privacypilot_vendors.
    // WHY: Links the transfer to the specific supplier sending data abroad. Indexed
    //      because "find transfers for this vendor" is a common query.
    // EXAMPLE: "ven-mailchimp". Null if the transfer is not tied to a vendor.
    @Indexed
    private String vendorId;

    // WHAT: The id of the ProcessingActivity this transfer belongs to, if any.
    //       Holds the `_id` of a document in privacypilot_activities.
    // WHY: Ties the transfer to the register activity whose data is being sent.
    //      Indexed because "find transfers for this activity" is a common query.
    // EXAMPLE: "act-newsletter". Null if not tied to one activity.
    @Indexed
    private String activityId;

    // WHAT: The country the data is sent to (Art. 30(1)(e)).
    // WHY: The register must name the third country the data leaves the EEA for.
    // EXAMPLE: "USA", "India".
    private String destinationCountry;

    // WHAT: Who receives the data at the destination.
    // WHY: The register must identify the party abroad that gets the data.
    // EXAMPLE: "Mailchimp LLC".
    private String recipient;

    // WHAT: The legal tool that makes this out-of-EEA transfer allowed.
    // WHY: Sending data abroad is only legal WITH a safeguard — this says which one.
    // EXAMPLE: ADEQUACY (Art. 45), SCC (Art. 46), BCR (Art. 47), DEROGATION (Art. 49).
    private TransferMechanism mechanism;

    // WHAT: A short note explaining the adequacy / safeguard situation for this country.
    // WHY: Gives an auditor the reasoning behind the chosen mechanism.
    // EXAMPLE: "USA recipient certified under the EU-US Data Privacy Framework."
    private String adequacyNote;

    // WHAT: True if a Transfer Impact Assessment (TIA) has been documented.
    // WHY: After Schrems II, a non-adequacy transfer must be checked to see if the
    //      destination country's laws undermine the safeguards. A missing TIA on a
    //      non-adequacy transfer is flagged as a risk on the page.
    // EXAMPLE: true once the TIA is completed; false otherwise.
    private boolean tiaDocumented;

    // WHAT: A reference (link or id) to the actual TIA document, if one exists.
    // WHY: Lets you find the evidence behind the tiaDocumented flag.
    // EXAMPLE: "TIA-2026-004". Empty when no TIA has been done.
    private String tiaRef;
}
