package com.regulaone.backend.dto.Auth;

import com.regulaone.backend.models.TenantModule;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class InviteUserRequest {

    @NotBlank
    private String name;

    @NotBlank
    @Email
    private String email;

    private String role = "ROLE_USER";

    @NotBlank
    private String tenantId;

    // Added: admin can explicitly choose which modules the invited user may access.
    // If empty/null at invite time, defaults to the package's appIds so that new
    // members get the same module set the organisation paid for.
    private List<TenantModule> moduleIds = new ArrayList<>();
}
