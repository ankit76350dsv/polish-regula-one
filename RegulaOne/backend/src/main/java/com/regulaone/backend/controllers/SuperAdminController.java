package com.regulaone.backend.controllers;

import com.regulaone.backend.dto.AppResponse;
import com.regulaone.backend.dto.Auth.UpdateUserStatusRequest;
import com.regulaone.backend.dto.Auth.UserResponse;
import com.regulaone.backend.dto.Platform.PlatformOverviewResponse;
import com.regulaone.backend.dto.Tenant.TeamManagementStatsResponse;
import com.regulaone.backend.services.PlatformService;
import com.regulaone.backend.services.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/superadmin")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
public class SuperAdminController {

    private final UserService     userService;
    private final PlatformService platformService;

    @GetMapping("/overview")
    public ResponseEntity<AppResponse<PlatformOverviewResponse>> getPlatformOverview() {
        return ResponseEntity.ok(AppResponse.success(
                "Platform overview loaded",
                platformService.getPlatformOverview()));
    }

    @GetMapping("/team-management")
    public ResponseEntity<AppResponse<TeamManagementStatsResponse>> getTeamManagementStats() {
        return ResponseEntity.ok(AppResponse.success(
                "Team stats loaded",
                userService.getTeamManagementStats()));
    }

    @GetMapping("/list-all-users")
    public ResponseEntity<AppResponse<List<UserResponse>>> getAllUsers() {
        return ResponseEntity.ok(AppResponse.success(
                "All users loaded",
                userService.getAllUsers()));
    }

    @GetMapping("/tenants/{tenantId}/users")
    public ResponseEntity<AppResponse<List<UserResponse>>> getUsersByTenant(
            @PathVariable String tenantId) {
        return ResponseEntity.ok(AppResponse.success(
                "Tenant users loaded",
                userService.getAllUsers(tenantId)));
    }

    @PatchMapping("/users/{userId}/status")
    public ResponseEntity<AppResponse<UserResponse>> updateUserStatus(
            @PathVariable String userId,
            @RequestBody UpdateUserStatusRequest request) {
        return ResponseEntity.ok(AppResponse.success(
                "User status updated successfully",
                userService.updateUserStatus(userId, request)));
    }
}
