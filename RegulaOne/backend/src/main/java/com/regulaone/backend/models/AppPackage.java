package com.regulaone.backend.models;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;


@Document(collection = "packages")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AppPackage {

    @Id
    private String id;

    // Package display name — must be unique to avoid billing confusion
    @Indexed(unique = true)
    private String name;

    private String description;

    // BigDecimal used for price to avoid floating-point precision issues in billing
    private BigDecimal price;

    // ISO 4217 currency code (e.g. EUR, PLN, USD)
    private String currency;

    // Billing cycle: MONTHLY, YEARLY, or LIFETIME
    private DurationType durationType;

    private Integer duration;

    // The compliance apps included in this package.
    // Reuses TenantModule enum — adding a new app only requires adding an enum value.
    @Builder.Default
    private List<TenantModule> appIds = new ArrayList<>();

    // Controls visibility and assignability of the package
    @Builder.Default
    private PackageStatus status = PackageStatus.ACTIVE;


    // Audit timestamps
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime updatedAt;
}
