package com.ksefflow.backend.dto.ksefapi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

// Response (202 Accepted) from the grant/revoke permission endpoints. Permission changes are
// asynchronous — we get a referenceNumber we can poll at GET /permissions/operations/{ref}.
@JsonIgnoreProperties(ignoreUnknown = true)
public record PermissionsOperationResponse(String referenceNumber) {}
