package com.regulaone.backend.dto.Auth;



import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateUserStatusRequest {

    @NotNull(message = "enabled is required")
    private Boolean enabled;
}
