package com.regulaone.backend.controllers;

import com.regulaone.backend.dto.Auth.UpdateUserStatusRequest;
import com.regulaone.backend.dto.Auth.UserResponse;
import com.regulaone.backend.dto.Tenant.TeamManagementStatsResponse;
import com.regulaone.backend.services.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// Added: exposes platform-wide management endpoints for ROLE_SUPER_ADMIN.
//
// The security config already protects /api/superadmin/** with hasAuthority('ROLE_SUPER_ADMIN'),
// but the DispatcherServlet was returning 404 (no static resource) because no controller
// was mapped to this path prefix. This class resolves that.
//
// All service methods called here have no-arg overloads in UserService that operate
// across all tenants (unlike the tenant-scoped overloads used by AdminController).
@RestController
@RequestMapping("/api/superadmin")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
public class SuperAdminController {

    private final UserService userService;

    // Returns platform-wide stats aggregated across all tenants:
    // totalMembers, activeMembers, suspendedMembers, admins.
    // Consumed by the Team Management stats cards on the super-admin dashboard.
    @GetMapping("/team-management")
    public ResponseEntity<TeamManagementStatsResponse> getTeamManagementStats() {
        return ResponseEntity.ok(userService.getTeamManagementStats());
    }

    // Returns every user record across all tenants.
    // Used to populate the platform-wide users table with search, filter, and pagination.
    @GetMapping("/list-all-users")
    public ResponseEntity<List<UserResponse>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    // Enables or disables any user by their MongoDB document ID.
    // ROLE_SUPER_ADMIN cannot call /api/admin/users/{userId}/status (403 — wrong role namespace),
    // so this endpoint mirrors that PATCH under the superadmin route prefix.
    @PatchMapping("/users/{userId}/status")
    public ResponseEntity<UserResponse> updateUserStatus(
            @PathVariable String userId,
            @RequestBody UpdateUserStatusRequest request) {
        return ResponseEntity.ok(userService.updateUserStatus(userId, request));
    }
}
