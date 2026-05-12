package com.regulaone.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ChangePasswordRequest {

    /** Cognito Access Token returned by /login (not the ID token). */
    @NotBlank
    private String accessToken;

    @NotBlank
    private String currentPassword;

    @NotBlank
    private String newPassword;
}
