package com.regulaone.backend.dto.Tenant;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Request body for PUT /api/admin/org — lets ROLE_ADMIN update their own organisation's details.
 *
 * Intentionally excludes:
 *   - nip    — Polish tax ID, a permanent legal identifier; only superadmin can change it.
 *   - regon  — Company registry number; same reason.
 *   - status — Only superadmin can suspend/deactivate a tenant.
 *
 * All fields are optional (PATCH semantics): null means "leave unchanged".
 * Different from TenantRequest (superadmin full-replacement, requires nip + status).
 */
@Data
public class UpdateOrgRequest {

    @Size(min = 2, max = 200, message = "Company name must be between 2 and 200 characters")
    private String name;

    @Email(message = "Must be a valid email address")
    private String email;

    @Pattern(
        regexp = "^[\\+\\-\\(\\)\\d ]{7,20}$",
        message = "Phone must be 7–20 characters and may contain +, -, (, ), digits, spaces"
    )
    private String phone;

    private String address;

    @Size(max = 100, message = "City must not exceed 100 characters")
    private String city;

    @Pattern(
        regexp = "^\\d{2}-\\d{3}$",
        message = "Postal code must match the format XX-XXX"
    )
    private String postalCode;
}
