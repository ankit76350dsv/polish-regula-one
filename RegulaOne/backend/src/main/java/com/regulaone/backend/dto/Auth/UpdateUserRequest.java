package com.regulaone.backend.dto.Auth;

import lombok.Data;

@Data
public class UpdateUserRequest {

    private String name;
    private String email;
    private String role;
}
