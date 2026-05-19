package com.regulaone.backend.dto.Auth;

import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Request body for PATCH /api/auth/me — lets any authenticated user update their own name.
 *
 * Only name is editable here:
 *   - email is the Cognito username (identity key); changing it requires admin action.
 *   - role cannot be self-assigned.
 *
 * Different from UpdateUserRequest (admin-targeted, includes email + role).
 */
@Data
public class UpdateProfileRequest {

    @Size(min = 2, max = 100, message = "Name must be between 2 and 100 characters")
    private String name;
}
