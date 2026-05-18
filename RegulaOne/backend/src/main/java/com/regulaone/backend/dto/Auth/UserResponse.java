package com.regulaone.backend.dto.Auth;

import com.regulaone.backend.models.User;
import lombok.Builder;
import lombok.Data;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AttributeType;
import software.amazon.awssdk.services.cognitoidentityprovider.model.UserType;

import java.time.LocalDateTime;
import java.time.ZoneId;
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
