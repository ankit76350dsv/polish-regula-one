package com.regulaone.backend.dto.Auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

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
}
