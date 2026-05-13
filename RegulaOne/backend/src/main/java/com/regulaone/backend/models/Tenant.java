package com.regulaone.backend.models;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * MongoDB document representing a Tenant (a company/organisation using RegulaOne).
 *
 * In a multi-tenant compliance platform, each Tenant is an independent business entity.
 * Users belong to a tenant; compliance modules are enabled per tenant.
 *
 * Polish-specific fields:
 *   nip   — Numer Identyfikacji Podatkowej (10-digit tax number, unique per company)
 *   regon — Rejestr Gospodarki Narodowej (9 or 14-digit national business registry number)
 *
 * Collection: "tenants"
 */
@Document(collection = "tenants")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Tenant {

    @Id
    private String id;

    // Company legal name — must be unique across all tenants
    @Indexed(unique = true)
    private String name;

    // Polish tax identification number — NIP (10 digits, mandatory for all Polish companies)
    @Indexed(unique = true)
    private String nip;

    // Polish national business registry number — REGON (9 or 14 digits)
    private String regon;

    // Primary contact email for the tenant organisation
    @Indexed(unique = true)
    private String email;

    private String phone;

    // Address fields stored flat (no embedded object) for simpler MongoDB querying
    private String address;
    private String city;
    private String postalCode;

    // Controls whether the tenant can access the platform
    // Defaults to ACTIVE when a new tenant is created
    @Builder.Default
    private TenantStatus status = TenantStatus.ACTIVE;

    // List of compliance modules enabled for this tenant
    // Stored as an enum list so new modules can be added without migration
    @Builder.Default
    private List<TenantModule> enabledModules = new ArrayList<>();

    // Audit timestamps — createdAt is set once at creation, updatedAt on every save
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime updatedAt;
}
