package com.regulaone.backend.models;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.DBRef;
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
 * Plan assignment model:
 *   AppPackage  — the catalogue entry (name, price, modules) — never mutated per tenant
 *   PackageDetails (currentPackage) — embeds a @DBRef to AppPackage plus per-tenant
 *                  validity dates (planStarted, planExpiring) so different tenants can have
 *                  different expiry windows for the same tier.
 *   PackageHistory — appended whenever a plan is changed or renewed; preserves audit trail.
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

    // Active package assignment — null until a super-admin assigns a plan.
    // Contains the @DBRef to the AppPackage catalogue entry plus the tenant-specific
    // validity window (planStarted, planExpiring).
    private PackageDetails currentPackage;

    // Full ordered history of every package ever assigned to this tenant.
    // Appended (never removed) when a plan is changed or renewed.
    @Builder.Default
    private List<PackageHistory> packageHistory = new ArrayList<>();

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime updatedAt;

    // ── Embedded: active plan assignment ─────────────────────────────────────────
    //
    // Stored inline inside the tenant document (not a separate MongoDB collection).
    // @DBRef appPackage links to the AppPackage document in the "packages" collection
    // so package metadata (name, price, modules) is kept in one place.
    // planStarted / planExpiring live here so each tenant has its own validity window.
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PackageDetails {

        // Reference to the AppPackage catalogue entry
        @DBRef
        private AppPackage appPackage;

        // Date the current plan became active for this tenant
        @Builder.Default
        private LocalDateTime planStarted = LocalDateTime.now();

        // Date the current plan expires — null means no expiry configured yet
        private LocalDateTime planExpiring;

        private String usersCapacity;
    }

    // ── Embedded: historical plan record ─────────────────────────────────────────
    //
    // Each entry records a past plan assignment.
    // planExpired is set to the moment the plan was replaced or expired.
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PackageHistory {

        // Reference to the AppPackage that was active during this period
        @DBRef
        private AppPackage appPackage;

        @Builder.Default
        private LocalDateTime planStarted = LocalDateTime.now();

        // When this plan ended (was replaced or expired)
        private LocalDateTime planExpired;

        private String usersCapacity;
    }
}
