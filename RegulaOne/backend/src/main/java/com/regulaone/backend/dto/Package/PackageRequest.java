package com.regulaone.backend.dto.Package;

import com.regulaone.backend.models.DurationType;
import com.regulaone.backend.models.PackageStatus;
import com.regulaone.backend.models.TenantModule;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Request body DTO used for both Create and Update package operations.
 *
 * Date validation (expiringDate must be after startingDate) is handled in
 * PackageService rather than here, because Jakarta class-level constraints
 * require a custom annotation — service-layer validation keeps the DTO simple.
 */
@Data
public class PackageRequest {

    @NotBlank(message = "Package name is required")
    @Size(min = 2, max = 100, message = "Package name must be between 2 and 100 characters")
    private String name;

    @Size(max = 500, message = "Description must not exceed 500 characters")
    private String description;

    @NotNull(message = "Price is required")
    @DecimalMin(value = "0.0", inclusive = true, message = "Price must be zero or greater")
    @Digits(integer = 10, fraction = 2, message = "Price must have at most 2 decimal places")
    private BigDecimal price;

    // ISO 4217 three-letter currency code (e.g. EUR, PLN, USD)
    @NotBlank(message = "Currency is required")
    @Size(min = 3, max = 3, message = "Currency must be a 3-letter ISO 4217 code (e.g. EUR, PLN)")
    private String currency;

    @NotNull(message = "Duration type is required")
    private DurationType durationType;

    // At least one app must be included — an empty package has no value to the tenant
    @NotEmpty(message = "At least one app must be included in the package")
    private List<TenantModule> appIds = new ArrayList<>();

    // Defaults to ACTIVE so newly created packages are immediately assignable
    private PackageStatus status = PackageStatus.ACTIVE;

    // Optional — defaults to LocalDateTime.now() in the service if not provided
    private LocalDateTime startingDate;

    // Must be after startingDate — validated in PackageService.validateDates()
    @NotNull(message = "Expiring date is required")
    private LocalDateTime expiringDate;
}
