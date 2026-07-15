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

    // Which role this sign-off is for (e.g. DPO or TENANT_ADMIN).
    private PrivacyRole role;

    // The name of the person who signs (or is expected to sign).
    private String name;

    // When they signed. Null means "not signed yet".
    private Instant approvedAt;
}
