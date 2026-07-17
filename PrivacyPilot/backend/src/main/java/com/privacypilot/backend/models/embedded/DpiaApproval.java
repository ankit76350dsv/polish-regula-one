package com.privacypilot.backend.model.embedded;

import com.privacypilot.backend.model.enums.user.PrivacyRole;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * One sign-off line on a DPIA. A DPIA usually needs approval from both the DPO
 * and the Company Admin. Each line says which role must sign, who signed, and
 * when. While {@code approvedAt} is null, that approval is still pending.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DpiaApproval {

    // WHAT: Which ROLE this sign-off is for (e.g. DPO or Company Admin).
    // WHY: Only a person with this exact role may sign this line — a Company Admin
    //      cannot sign the DPO's line and vice versa (separation of duties).
    // EXAMPLE: DPO for the first line, TENANT_ADMIN for the second.
    private PrivacyRole role;

    // WHAT: The name of the person who signed (or who is expected to sign).
    // WHY: Records WHO approved, for the audit trail. Empty until someone signs.
    // EXAMPLE: "Karolina Wójcik" (taken from the signer's login at sign-time).
    private String name;

    // WHAT: The date/time this line was signed.
    // WHY: Records WHEN it was approved. Null means "still pending / not signed yet".
    // EXAMPLE: 2026-07-17. Null while the line still shows "Pending".
    private Instant approvedAt;
}
