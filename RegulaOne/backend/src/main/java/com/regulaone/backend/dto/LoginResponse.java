package com.regulaone.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginResponse {

    // Present on successful authentication
    private String accessToken;
    private String idToken;
    private String refreshToken;
    private Integer expiresIn;
    private String tokenType;

    // Present when Cognito requires further action (e.g. NEW_PASSWORD_REQUIRED for invited users)
    private String challengeName;
    private String session;
    private String username;
}
