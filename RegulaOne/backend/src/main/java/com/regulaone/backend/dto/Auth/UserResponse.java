package com.regulaone.backend.dto.Auth;

import com.regulaone.backend.models.TenantModule;
import com.regulaone.backend.models.User;
import lombok.Builder;
import lombok.Data;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AttributeType;
import software.amazon.awssdk.services.cognitoidentityprovider.model.UserType;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Data
@Builder
public class UserResponse {

    private String id;
    private String name;
    private String email;
    private String role;
    private boolean enabled;
    private boolean tempPassword;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // Added: tenant organisation fields surfaced on every /me response.
    // Frontend modal logic:
    //   ROLE_ADMIN  + tenantId == null                 → show "Setup your organisation" modal
    //   ROLE_USER   + tenantId == null                 → show "Organisation not found – contact your admin" modal
    //   tenantStatus == "INACTIVE" or "SUSPENDED"      → show appropriate disabled/suspended modal
    //   tenantStatus == "ACTIVE"                       → proceed to dashboard
    private String tenantId;
    private String tenantName;
    private String tenantStatus;

    // Plan expiry fields — derived from tenant.currentPackage.expiringDate.
    // Frontend logic:
    //   planExpired      → show "Plan Expired" blocking modal
    //   planExpiringSoon → show dismissable warning banner (within 7 days)
    //   planExpiresAt    → display exact expiry date in UI
    private LocalDateTime planExpiresAt;
    private boolean planExpired;
    private boolean planExpiringSoon;

    // Added: the AppPackage id assigned to this user's tenant.
    // Frontend uses this to know which plan tier the user is on.
    private String packageId;

    // Added: per-user list of compliance modules the user is allowed to access.
    // Assigned during org setup (from package defaults) or during invite (admin choice).
    // Frontend reads this to show/hide sidebar items — a module absent here is hidden.
    private List<TenantModule> moduleIds;

    // Added: cross-app permission codes for this user (e.g. KSEF_TENANT_ADMIN).
    // Other apps (KSeFFlow, etc.) read this from /me to decide what the user can do.
    // Always a list (never null) so callers can iterate without a null-check.
    private List<String> permissions;

    public static UserResponse from(User user) {
        // Derive tenant fields — Tenant may be null when no organisation has been set up yet
        String tenantId = null;
        String tenantName = null;
        String tenantStatus = null;
        if (user.getTenant() != null) {
            tenantId = user.getTenant().getId();
            tenantName = user.getTenant().getName();
            tenantStatus = user.getTenant().getStatus() != null
                    ? user.getTenant().getStatus().name()
                    : null;
        }

        // Derive plan expiry — read from the @DBRef-resolved currentPackage.
        // Handles null tenant, null package, and null expiringDate gracefully.
        LocalDateTime planExpiresAt = null;
        boolean planExpired = false;
        boolean planExpiringSoon = false;
        if (user.getTenant() != null && user.getTenant().getCurrentPackage() != null) {
            // planExpiring lives on Tenant.PackageDetails (tenant-specific validity window),
            // not on AppPackage (which is a shared catalogue entry without per-tenant dates).
            LocalDateTime expiresAt = user.getTenant().getCurrentPackage().getPlanExpiring();
            if (expiresAt != null) {
                LocalDateTime now = LocalDateTime.now();
                planExpiresAt    = expiresAt;
                planExpired      = expiresAt.isBefore(now);
                planExpiringSoon = !planExpired && expiresAt.isBefore(now.plusDays(7));
            }
        }

        // Derive packageId — the AppPackage catalogue id assigned to this tenant.
        // Null when tenant has no active package (e.g. just created, not yet assigned).
        String packageId = null;
        if (user.getTenant() != null
                && user.getTenant().getCurrentPackage() != null
                && user.getTenant().getCurrentPackage().getAppPackage() != null) {
            packageId = user.getTenant().getCurrentPackage().getAppPackage().getId();
        }

        // User-level module access list — empty list instead of null so the frontend
        // never has to null-check before iterating.
        List<TenantModule> moduleIds = (user.getModuleIds() != null)
                ? user.getModuleIds()
                : new ArrayList<>();

        // Cross-app permission codes — empty list instead of null for the same reason.
        // Older user documents created before this field existed will have null in
        // MongoDB; we normalise that to an empty list here.
        List<String> permissions = (user.getPermissions() != null)
                ? user.getPermissions()
                : new ArrayList<>();

        return UserResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole().name())
                .enabled(user.isEnabled())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .tenantId(tenantId)
                .tenantName(tenantName)
                .tenantStatus(tenantStatus)
                .planExpiresAt(planExpiresAt)
                .planExpired(planExpired)
                .planExpiringSoon(planExpiringSoon)
                .packageId(packageId)
                .moduleIds(moduleIds)
                .permissions(permissions)
                .build();
    }

    public static UserResponse fromCognitoUser(UserType user) {
        Map<String, String> attrs = user.attributes().stream()
                .collect(Collectors.toMap(AttributeType::name, AttributeType::value));
        return UserResponse.builder()
                .id(attrs.getOrDefault("sub", user.username()))
                .name(attrs.getOrDefault("name", ""))
                .email(attrs.getOrDefault("email", user.username()))
                .enabled(Boolean.TRUE.equals(user.enabled()))
                .createdAt(user.userCreateDate() != null
                        ? LocalDateTime.ofInstant(user.userCreateDate(), ZoneId.systemDefault())
                        : null)
                .build();
    }
}
