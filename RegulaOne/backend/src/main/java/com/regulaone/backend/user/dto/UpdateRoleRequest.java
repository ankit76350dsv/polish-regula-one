package com.regulaone.backend.user.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Change what a colleague may do in the organisation.
 *
 * The value is the role name as the platform stores it — "ROLE_ADMIN" or "ROLE_USER".
 * It is deliberately a plain string rather than the {@code Role} enum: an unknown value
 * must come back as a clear 400 with a message the screen can show, not as an unreadable
 * deserialisation failure.
 *
 * WHICH VALUES ARE ACCEPTED IS DECIDED IN THE SERVICE, NOT HERE. Only ROLE_ADMIN and
 * ROLE_USER may be set through this request; ROLE_SUPER_ADMIN is a platform-operator role
 * and a company administrator must never be able to grant it to anybody, including
 * themselves. See UserAdminService#updateUserRole.
 */
@Data
public class UpdateRoleRequest {

    @NotBlank(message = "role is required")
    private String role;
}
