package com.regulaone.backend.models;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * MongoDB document representing the assignment of an AppPackage to a Tenant.
 *
 * Acts as a junction (many-to-many) between Tenant and AppPackage:
 *   - One tenant can have multiple packages (e.g. Basic + Add-on)
 *   - One package can be assigned to many tenants
 *
 * A compound unique index on (tenantId + packageId) prevents the same package
 * from being assigned to the same tenant more than once.
 *
 * When a TenantPackage record is created or deleted, PackageService calls
 * syncTenantModules() to recalculate and persist Tenant.enabledModules.
 *
 * Collection: "tenant_packages"
 */
@Document(collection = "tenant_packages")
@CompoundIndex(def = "{'tenantId': 1, 'packageId': 1}", unique = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TenantPackage {

    @Id
    private String id;

    // Reference to Tenant._id
    private String tenantId;

    // Reference to AppPackage._id
    private String packageId;

    // Cognito sub (or email) of the super admin who performed the assignment — for audit trail
    private String assignedBy;

    @Builder.Default
    private LocalDateTime assignedAt = LocalDateTime.now();
}
