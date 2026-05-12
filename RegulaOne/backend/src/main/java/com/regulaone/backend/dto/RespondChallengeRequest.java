package com.regulaone.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RespondChallengeRequest {

    /** Email / username returned in the challenge response from /login. */
    @NotBlank
    private String username;

    /** Session string returned in the challenge response from /login. */
    @NotBlank
    private String session;

    @NotBlank
    private String newPassword;
}
