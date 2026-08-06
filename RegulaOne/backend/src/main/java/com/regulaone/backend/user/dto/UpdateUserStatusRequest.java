package com.regulaone.backend.user.dto;



import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateUserStatusRequest {

    @NotNull(message = "enabled is required")
    private Boolean enabled;
}
