package com.regulaone.backend.dto.Auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ConfirmSignupRequest {

    @NotBlank
    @Email
    private String email;

    @NotBlank
    private String code;
}
