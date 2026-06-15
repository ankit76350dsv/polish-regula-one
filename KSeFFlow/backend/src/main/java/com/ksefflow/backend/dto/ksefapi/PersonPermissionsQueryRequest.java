package com.ksefflow.backend.dto.ksefapi;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

// Request body for POST /permissions/query/persons/grants — lists the person-permissions in
// the current context. Only queryType is required.
//
// queryType is one of:
//   "PermissionsInCurrentContext"        — permissions that apply in this context
//   "PermissionsGrantedInCurrentContext" — permissions that were granted in this context
//
// permissionTypes is an optional filter (KSeF permission codes). Null/empty fields are dropped
// from the JSON so we only send what we mean.
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PersonPermissionsQueryRequest(
        String queryType,
        List<String> permissionTypes) {}
