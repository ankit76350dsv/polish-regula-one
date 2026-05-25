package com.ksefflow.backend.dto.ksefapi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// Step 1 of KSeF auth: request body sent to POST /online/Session/AuthorisationChallenge
// The government responds with a random challenge string that must be signed with
// the company's private key to prove identity.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KsefChallengeRequest {

    private KsefContextIdentifier contextIdentifier;

    public static KsefChallengeRequest forNip(String nip) {
        return new KsefChallengeRequest(KsefContextIdentifier.ofNip(nip));
    }
}
