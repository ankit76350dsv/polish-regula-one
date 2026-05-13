package com.regulaone.backend.controllers;

import com.regulaone.backend.dto.*;
import com.regulaone.backend.services.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminController {

    private final UserService userService;

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
