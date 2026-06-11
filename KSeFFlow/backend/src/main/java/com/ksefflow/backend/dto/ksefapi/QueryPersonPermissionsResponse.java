package com.ksefflow.backend.dto.ksefapi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

// Response from POST /permissions/query/persons/grants — the list of person permissions.
// We keep the fields the UI needs; KSeF may add more (ignoreUnknown keeps us compatible).
@JsonIgnoreProperties(ignoreUnknown = true)
public record QueryPersonPermissionsResponse(
        List<PersonPermission> permissions,
        boolean hasMore) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PersonPermission(
            String id,                       // permission id — used to revoke it
            Identifier authorizedIdentifier, // who holds the permission
            Identifier authorIdentifier,     // who granted it
            String permissionScope,          // which permission this is
            String permissionState,          // Active / Inactive
            String description,
            String startDate,
            boolean canDelegate) {}

    // A generic {type, value} identifier (NIP / PESEL / fingerprint).
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Identifier(String type, String value) {}
}
