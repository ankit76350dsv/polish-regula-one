package com.ksefflow.backend.dto.ksefapi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

// Response from GET /permissions/operations/{referenceNumber} — tells us how a grant/revoke went.
// status.code(): 100 = processing, 200 = success, 4xx = failed (see API docs for the exact reason).
@JsonIgnoreProperties(ignoreUnknown = true)
public record PermissionsOperationStatusResponse(StatusInfo status) {}
