package com.privacypilot.backend.model.embedded;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * The company's legal details, shown on privacy notices and the ROPA as the
 * "controller identity" (Art. 13(1)(a) / 14(1)(a) GDPR). Stored inside the
 * tenant's settings, not as its own collection.
 *
 * NIP, REGON and KRS are the official Polish company registration numbers.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CompanyDetails {

    // Full legal company name (e.g. "ABC Logistics Poland Sp. z o.o.").
    private String name;

    // Polish tax identification number (NIP).
    private String nip;

    // Polish statistical number (REGON).
    private String regon;

    // Polish court register number (KRS).
    private String krs;

    // Registered office address.
    private String address;

    // Company website address.
    private String website;
}
