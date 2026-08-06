package com.regulaone.backend.user.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateEmailNotificationRequest {

    @NotNull(message = "emailNotification is required")
    private Boolean emailNotification;
}
