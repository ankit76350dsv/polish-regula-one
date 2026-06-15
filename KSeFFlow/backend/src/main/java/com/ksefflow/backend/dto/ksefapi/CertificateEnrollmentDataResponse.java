package com.ksefflow.backend.dto.ksefapi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

// Response from GET /certificates/enrollments/data.
// KSeF tells us exactly which identity fields (the "subject") must go INTO the certificate
// request (CSR). We must not invent these — we copy them straight into the CSR subject so the
// issued certificate matches what KSeF expects.
@JsonIgnoreProperties(ignoreUnknown = true)
public record CertificateEnrollmentDataResponse(
        String commonName,             // CN — common name
        String countryName,            // C  — ISO country code
        String givenName,              // first name (for a person)
        String surname,                // last name (for a person)
        String serialNumber,           // subject serial number
        String uniqueIdentifier,       // unique identifier
        String organizationName,       // O  — organisation name
        String organizationIdentifier  // organisation identifier
) {}
