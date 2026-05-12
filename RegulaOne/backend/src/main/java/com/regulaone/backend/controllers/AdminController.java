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

    /** Send an invitation email with a temporary password */
    @PostMapping("/users/invite")
    public ResponseEntity<UserResponse> inviteUser(@Valid @RequestBody InviteUserRequest request) {
        return ResponseEntity.ok(userService.inviteUser(request));
    }

    /** List all users */
    @GetMapping("/users")
    public ResponseEntity<List<UserResponse>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    /** Update a user's name, email, or role */
    @PutMapping("/users/{userId}")
    public ResponseEntity<UserResponse> updateUser(
            @PathVariable String userId,
            @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(userService.updateUser(userId, request));
    }

    /** Delete a user by ID */
    @DeleteMapping("/users/{userId}")
    public ResponseEntity<MessageResponse> deleteUser(@PathVariable String userId) {
        userService.deleteUser(userId);
        return ResponseEntity.ok(new MessageResponse("User deleted successfully"));
    }
}
