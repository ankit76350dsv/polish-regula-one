package com.ksefflow.backend.dto.ksefapi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// Identifies the company/entity making the KSeF API request.
// type is always "onip" when authenticating with a NIP (Polish tax ID).
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KsefContextIdentifier {

    // Identifier type — "onip" for NIP-based authentication
    private String type;

    // The Polish NIP number (10 digits, no dashes)
    private String identifier;

    public static KsefContextIdentifier ofNip(String nip) {
        return new KsefContextIdentifier("onip", nip);
    }
}
