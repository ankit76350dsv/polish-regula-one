package com.regulaone.backend.dto.Package;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Response for GET /api/superadmin/tier-changes.
 *
 * Updated: one entry now represents any package assignment event for a tenant
 * (initial assignment or renewal), not just plan-name changes.
 * getTierChanges() collects all currentPackage + packageHistory entries across
 * all tenants, sorted newest-first, so the frontend can show "Recent Plan Assignments".
 *
 * reason is nullable — only set when the admin explicitly supplied one.
 * planExpiring is nullable — null for LIFETIME plans or when not set.
 *
 * OLD behaviour (kept for history):
 * Was: detected consecutive packageHistory entries with different package names.
 * fromPlan held the previous plan name; toPlan held the new plan name.
 * That approach missed initial assignments (no "from" plan) and produced an
 * empty table for tenants that never changed plans.
 */
@Data
@Builder
public class TierChangeResponse {

    private String tenantId;

    // Display name of the tenant org that was assigned the plan.
    private String tenantName;

    // OLD: previous plan name before the change — was used for change-detection logic.
    // Now always null; kept in the DTO for backward compatibility.
    // private String fromPlan; — no longer populated, see service update
    private String fromPlan;

    // The package that was assigned (current or historical).
    private String toPlan;

    // When the assignment became active (Tenant.PackageDetails.planStarted or PackageHistory.planStarted).
    private LocalDateTime changedAt;

    // Added: when this assignment expires (Tenant.PackageDetails.planExpiring).
    // Null for LIFETIME plans or history entries where planExpiring was not recorded.
    private LocalDateTime planExpiring;

    // Human-readable reason supplied by the admin. Null for initial or legacy entries.
    private String reason;
}
