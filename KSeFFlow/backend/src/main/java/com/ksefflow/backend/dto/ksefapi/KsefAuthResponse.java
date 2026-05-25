package com.ksefflow.backend.dto.ksefapi;

import lombok.Data;

// Response from POST /online/Session/Authorisation.
// On success the government returns a session token that must be included
// as the "SessionToken" header in all subsequent KSeF API requests.
@Data
public class KsefAuthResponse {

    private SessionTokenWrapper sessionToken;

    // Server timestamp of when the session was created
    private String timestamp;

    // KSeF reference number — stored for traceability in audit logs
    private String referenceNumber;

    @Data
    public static class SessionTokenWrapper {
        // The opaque session token string — treat like a password, store encrypted
        private String token;
    }
}
