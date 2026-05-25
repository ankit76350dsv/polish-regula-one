package com.ksefflow.backend.dto.ksefapi;

import lombok.Data;

// Response from POST /online/Session/AuthorisationChallenge.
// The challenge string must be signed with the company's RSA private key
// and included in the follow-up POST /online/Session/Authorisation request.
@Data
public class KsefChallengeResponse {

    // Random challenge string from the government (e.g. "20230101-CR-XXXXX...")
    // Sign this with SHA256withRSA using the tenant's private key
    private String challenge;

    // Server-side timestamp of when this challenge was issued
    private String timestamp;
}
