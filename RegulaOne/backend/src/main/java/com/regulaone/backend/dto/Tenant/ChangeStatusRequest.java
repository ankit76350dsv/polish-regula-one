package com.regulaone.backend.dto.Tenant;

import com.regulaone.backend.models.TenantStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * Request body for PATCH /api/superadmin/tenant/{id}/status.
 * Only the status field is updated — all other tenant data remains unchanged.
 */
@Data
public class ChangeStatusRequest {

    @NotNull(message = "Status is required")
    private TenantStatus status;
}
