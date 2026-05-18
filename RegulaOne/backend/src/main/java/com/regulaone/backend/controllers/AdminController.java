package com.regulaone.backend.controllers;

import com.regulaone.backend.dto.*;
import com.regulaone.backend.dto.Auth.InviteUserRequest;
import com.regulaone.backend.dto.Auth.UpdateUserRequest;
import com.regulaone.backend.dto.Auth.UserResponse;
import com.regulaone.backend.dto.Tenant.TenantRequest;
import com.regulaone.backend.services.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminController {

    private final UserService userService;

    // Added: first-login org setup for ROLE_ADMIN.
    // On first login the admin has no tenant linked (tenantId == null in /me response).
    // The frontend shows a "Setup your organisation" modal; on submit it calls this endpoint.
    // After success, /me returns tenantStatus == "ACTIVE" and the dashboard is unlocked.
    @PostMapping("/org/setup")
    public ResponseEntity<UserResponse> setupOrganisation(
            @Valid @RequestBody TenantRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(userService.setupOrganisation(jwt.getSubject(), request));
    }

    /**
     * Invite a user — Cognito creates the account and emails a temporary password.
     * {username} in other endpoints = the invited user's email (Cognito username).
     */
    @PostMapping("/users/invite")
    public ResponseEntity<UserResponse> inviteUser(@Valid @RequestBody InviteUserRequest request) {
        return ResponseEntity.ok(userService.inviteUser(request));
    }

    @GetMapping("/users")
    public ResponseEntity<List<UserResponse>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    /** Update name, email, and/or role of an existing Cognito user. */
    @PutMapping("/users/{subId}")
    public ResponseEntity<UserResponse> updateUser(
            @PathVariable String subId,
            @RequestBody UpdateUserRequest request) {
               
        return ResponseEntity.ok(userService.updateUser(subId, request));
    }

    @DeleteMapping("/users/{username}")
    public ResponseEntity<MessageResponse> deleteUser(@PathVariable String username) {
        userService.deleteUser(username);
        return ResponseEntity.ok(new MessageResponse("User deleted successfully"));
    }
}
