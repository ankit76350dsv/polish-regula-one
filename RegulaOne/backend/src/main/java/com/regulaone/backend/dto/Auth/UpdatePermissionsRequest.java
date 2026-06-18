package com.regulaone.backend.dto.Auth;

import lombok.Data;

import java.util.List;

// DTO for PATCH /api/admin/users/{userId}/permissions
// Allows ROLE_ADMIN to replace a user's cross-app permission codes in one operation.
// The codes are plain strings (e.g. "KSEF_AUDITOR") — each module owns its own set,
// so RegulaOne does not validate them against a fixed enum here.
@Data
public class UpdatePermissionsRequest {
    private List<String> permissions;
}
