package com.regulaone.backend.dto.Tenant;

import com.regulaone.backend.models.TenantModule;
import com.regulaone.backend.models.TenantStatus;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * Shared DTO used for both Create and Update tenant operations.
 *
 * Validation rules follow Polish business registration requirements:
 *   - NIP must be exactly 10 digits
 *   - REGON must be 9 or 14 digits (both formats are valid in Poland)
 *   - Email is mandatory for billing and compliance notifications
 */
@Data
public class TenantRequest {

    @NotBlank(message = "Company name is required")
    @Size(min = 2, max = 200, message = "Company name must be between 2 and 200 characters")
    private String name;

    // NIP — Polish tax number: exactly 10 digits, no dashes or spaces
    @NotBlank(message = "NIP is required")
    @Pattern(regexp = "\\d{10}", message = "NIP must be exactly 10 digits")
    private String nip;

    // REGON — Polish national business registry: 9 digits (sole traders) or 14 digits (companies)
    @Pattern(regexp = "\\d{9}|\\d{14}", message = "REGON must be 9 or 14 digits")
    private String regon;

    @NotBlank(message = "Email is required")
    @Email(message = "Please provide a valid email address")
    private String email;

    @Pattern(regexp = "^[+]?[0-9\\s\\-()]{7,20}$", message = "Please provide a valid phone number")
    private String phone;

    private String address;

    @Size(max = 100, message = "City name must not exceed 100 characters")
    private String city;

    // Polish postal code format: XX-XXX (e.g. 00-001) — optional but validated if provided
    @Pattern(regexp = "\\d{2}-\\d{3}", message = "Postal code must match format XX-XXX (e.g. 00-001)")
    private String postalCode;

    // Defaults to ACTIVE for new tenants; admin can set to INACTIVE or SUSPENDED
    private TenantStatus status = TenantStatus.ACTIVE;

    // Which RegulaOne modules are enabled for this tenant — can be empty list
    private List<TenantModule> enabledModules = new ArrayList<>();
}
