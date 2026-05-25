package com.ksefflow.backend.dto.ksefapi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// The digital signature payload sent to KSeF during session authorisation.
// The government uses this to verify the challenge was signed by the private key
// that belongs to the certificate supplied in the same request.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KsefSignatureDto {

    // Base64-encoded bytes: SHA256withRSA signature of the challenge string
    private String value;

    // Signing algorithm identifier — KSeF requires exactly "SHA256withRSA"
    private String algorithm;

    // Hash algorithm used inside the signing — KSeF requires "SHA-256"
    private String hashingAlgorithm;

    public static KsefSignatureDto of(String base64SignedChallenge) {
        return new KsefSignatureDto(base64SignedChallenge, "SHA256withRSA", "SHA-256");
    }
}
