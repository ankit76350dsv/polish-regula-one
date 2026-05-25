package com.ksefflow.backend.dto.ksefapi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// Declares the invoice document type sent during KSeF session authorisation.
// We always use FA(2) for the auth request even when submitting FA(3) invoices —
// the session type controls API access, not the invoice schema version.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KsefDocumentType {

    private String type;    // always "FA"
    private String version; // "FA(2)"

    public static KsefDocumentType fa2() {
        return new KsefDocumentType("FA", "FA(2)");
    }
}
