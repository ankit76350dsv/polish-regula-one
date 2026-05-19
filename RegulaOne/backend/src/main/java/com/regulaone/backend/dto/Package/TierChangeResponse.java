package com.regulaone.backend.dto.Package;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Response for GET /api/superadmin/tier-changes.
 *
 * One entry represents a plan upgrade or downgrade event for a tenant.
 * Built by PackageService.getTierChanges() by scanning Tenant.packageHistory
 * and detecting consecutive entries with different package names.
 *
 * reason is nullable — only populated when it was explicitly set via an
 * admin action that recorded a reason. Historical or auto-generated entries
 * will have reason == null; the frontend should display "—" in that case.
 */
@Data
@Builder
public class TierChangeResponse {

    private String tenantId;

    // Display name of the tenant org that changed plans.
    private String tenantName;

    // Package name the tenant was on before the change (null for initial assignment).
    private String fromPlan;

    // Package name the tenant moved to.
    private String toPlan;

    // Timestamp when the new plan became active (planStarted of the new assignment).
    private LocalDateTime changedAt;

    // Human-readable reason for the change — set by the admin who initiated it.
    // Null if the change was automated or predates the reason field.
    private String reason;
}
