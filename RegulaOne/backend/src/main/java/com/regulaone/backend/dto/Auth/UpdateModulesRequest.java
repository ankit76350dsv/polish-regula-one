package com.regulaone.backend.dto.Auth;

import com.regulaone.backend.models.TenantModule;
import lombok.Data;

import java.util.List;

// DTO for PATCH /api/admin/users/{userId}/modules
// Allows ROLE_ADMIN to replace a user's module access list in one operation.
@Data
public class UpdateModulesRequest {
    private List<TenantModule> moduleIds;
}
