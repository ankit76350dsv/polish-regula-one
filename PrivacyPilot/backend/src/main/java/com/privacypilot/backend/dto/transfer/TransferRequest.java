package com.privacypilot.backend.dto.transfer;

import com.privacypilot.backend.model.enums.gdpr.TransferMechanism;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * The payload for CREATING or UPDATING a third-country transfer (GDPR Chapter V).
 *
 * It carries only the fields a user fills in. The server owns id, tenantId, the
 * timestamps and the created/updated-by stamps. A transfer MUST name where the data
 * goes, who receives it and the legal tool that makes it safe — so those three are
 * required. The mechanism enum accepts the string code ("scc", "adequacy", …); an
 * unknown code is rejected as 400 by the enum's JsonCreator.
 *
 * vendorId / activityId are OPTIONAL links; when given, the service verifies they
 * belong to the caller's own tenant, so a transfer can never point at a missing or
 * another company's record.
 */
@Data
public class TransferRequest {

    // Optional link to the processor (vendor) that sends the data abroad.
    private String vendorId;

    // Optional link to the processing activity whose data is being sent.
    private String activityId;

    @NotBlank(message = "destinationCountry is required")
    private String destinationCountry;

    @NotBlank(message = "recipient is required")
    private String recipient;

    // The legal safeguard for the transfer — a transfer is not lawful without one.
    @NotNull(message = "mechanism is required")
    private TransferMechanism mechanism;

    // A short note about the adequacy / safeguard situation (free text).
    private String adequacyNote;

    // Whether a Transfer Impact Assessment (Schrems II) has been documented.
    private boolean tiaDocumented;

    // A reference to the TIA document, if any.
    private String tiaRef;
}
