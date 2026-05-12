package com.regulaone.backend.dto;

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

    public static UserResponse from(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole().name())
                .enabled(user.isEnabled())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
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
