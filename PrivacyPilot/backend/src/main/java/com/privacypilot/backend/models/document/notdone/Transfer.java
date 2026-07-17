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

    // The Vendor this transfer relates to, if any. Null if not vendor-specific.
    @Indexed
    private String vendorId;

    // The ProcessingActivity this transfer relates to, if any.
    @Indexed
    private String activityId;

    // The country the data is sent to (Art. 30(1)(e)).
    private String destinationCountry;

    // Who receives the data at the destination.
    private String recipient;

    // The legal transfer tool used (adequacy, SCC, BCR, or Art. 49 derogation).
    private TransferMechanism mechanism;

    // A note explaining the adequacy/safeguard situation for this country.
    private String adequacyNote;

    // True if a Transfer Impact Assessment (TIA) has been documented. A TIA
    // checks whether the destination country's laws undermine the safeguards.
    private boolean tiaDocumented;

    // A reference to the TIA document, if one exists.
    private String tiaRef;
}
