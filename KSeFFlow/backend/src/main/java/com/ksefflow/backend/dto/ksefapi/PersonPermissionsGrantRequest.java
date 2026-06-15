package com.ksefflow.backend.dto.ksefapi;

import java.util.List;

// Request body for POST /permissions/persons/grants — gives a person the right to act in KSeF
// on behalf of this tenant (e.g. an employee or an accountant from a biuro rachunkowe).
//
// @param subjectIdentifier WHO we are giving rights to (by NIP / PESEL / certificate fingerprint)
// @param permissions       WHAT they may do (KSeF permission codes — see PersonPermissionType in the API)
// @param description        a short note explaining the grant (required by KSeF)
// @param subjectDetails     how the person identifies themselves to KSeF
public record PersonPermissionsGrantRequest(
        SubjectIdentifier subjectIdentifier,
        List<String> permissions,
        String description,
        SubjectDetails subjectDetails) {

    // type is one of: "Nip" (10 digits), "Pesel" (11 digits), "Fingerprint" (certificate fingerprint).
    public record SubjectIdentifier(String type, String value) {}

    // subjectDetailsType is one of: "PersonByIdentifier", "PersonByFingerprintWithIdentifier",
    // "PersonByFingerprintWithoutIdentifier". Only this field is strictly required by KSeF.
    public record SubjectDetails(String subjectDetailsType) {}
}
