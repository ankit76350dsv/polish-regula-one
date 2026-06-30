package com.regulaone.backend.controllers;

import com.regulaone.backend.dto.AppResponse;
import com.regulaone.backend.dto.Auth.UserResponse;
import com.regulaone.backend.services.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Endpoints for reading user accounts. Identity (the user records) lives in RegulaOne,
 * so module apps (SafeVoice, KSeFFlow, …) read their staff lists from here.
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    // Lists ALL users of the caller's own organisation. Each user carries its enabled
    // modules and permission codes, so a module app (SafeVoice, KSeFFlow, …) can show the
    // whole team and visually highlight which members actually have access to that module.
    // The tenant id comes from the JWT (never from the client), so a user can only ever
    // see their own organisation's members.
    @PreAuthorize("isAuthenticated()")
    @GetMapping("/tenant/users")
    public ResponseEntity<AppResponse<List<UserResponse>>> getTenantUsers(
            @AuthenticationPrincipal Jwt jwt) {
        String tenantId = userService.getCurrentUser(jwt.getSubject()).getTenantId();
        return ResponseEntity.ok(AppResponse.success(
                "Users loaded",
                userService.getTenantUsers(tenantId)));
    }
}
