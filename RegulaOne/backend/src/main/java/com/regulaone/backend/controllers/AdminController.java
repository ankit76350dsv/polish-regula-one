package com.regulaone.backend.controllers;

import com.regulaone.backend.dto.AppResponse;
import com.regulaone.backend.dto.Admin.AdminPackageResponse;
import com.regulaone.backend.dto.Admin.InvoiceResponse;
import com.regulaone.backend.dto.Auth.InviteUserRequest;
import com.regulaone.backend.dto.Auth.UpdateModulesRequest;
import com.regulaone.backend.dto.Auth.UpdateEmailNotificationRequest;
import com.regulaone.backend.dto.Auth.UpdatePermissionsRequest;
import com.regulaone.backend.dto.Auth.UpdateUserRequest;
import com.regulaone.backend.dto.Auth.UpdateUserStatusRequest;
import com.regulaone.backend.dto.Auth.UserResponse;
import com.regulaone.backend.dto.Tenant.TeamManagementStatsResponse;
import com.regulaone.backend.dto.Tenant.TenantRequest;
import com.regulaone.backend.dto.Tenant.TenantResponse;
import com.regulaone.backend.dto.Tenant.UpdateOrgRequest;
import com.regulaone.backend.services.BillingService;
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

    private final UserService    userService;
    private final BillingService billingService;

    @PostMapping("/org/setup")
    public ResponseEntity<AppResponse<UserResponse>> setupOrganisation(
            @Valid @RequestBody TenantRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(AppResponse.success(
                "Organisation created successfully",
                userService.setupOrganisation(jwt.getSubject(), request)));
    }

    @PostMapping("/users/invite")
    public ResponseEntity<AppResponse<UserResponse>> inviteUser(
            @Valid @RequestBody InviteUserRequest request) {
        return ResponseEntity.ok(AppResponse.success(
                "User invited successfully. A temporary password has been sent to their email.",
                userService.inviteUser(request)));
    }

    @GetMapping("/users/{tenantId}")
    public ResponseEntity<AppResponse<List<UserResponse>>> getAllUsers(
            @PathVariable String tenantId) {
        return ResponseEntity.ok(AppResponse.success(
                "Users loaded",
                userService.getAllUsers(tenantId)));
    }

    @GetMapping("/team-management/{tenantId}")
    public ResponseEntity<AppResponse<TeamManagementStatsResponse>> getTeamManagementStats(
            @PathVariable String tenantId) {
        return ResponseEntity.ok(AppResponse.success(
                "Team stats loaded",
                userService.getTeamManagementStats(tenantId)));
    }

    @PatchMapping("/users/{userId}/modules")
    public ResponseEntity<AppResponse<UserResponse>> updateUserModules(
            @PathVariable String userId,
            @RequestBody UpdateModulesRequest request) {
        return ResponseEntity.ok(AppResponse.success(
                "Module access updated successfully",
                userService.updateUserModules(userId, request)));
    }

    // Lets an admin replace a user's cross-app permission codes (e.g. KSEF_AUDITOR).
    // Same shape as the modules endpoint above — the whole list is replaced at once.
    @PatchMapping("/users/{userId}/permissions")
    public ResponseEntity<AppResponse<UserResponse>> updateUserPermissions(
            @PathVariable String userId,
            @RequestBody UpdatePermissionsRequest request) {
        return ResponseEntity.ok(AppResponse.success(
                "User permissions updated successfully",
                userService.updateUserPermissions(userId, request)));
    }

    @PatchMapping("/users/{userId}/email-notification")
    public ResponseEntity<AppResponse<UserResponse>> updateUserEmailNotification(
            @PathVariable String userId,
            @Valid @RequestBody UpdateEmailNotificationRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(AppResponse.success(
                "User email notification preference updated successfully",
                userService.updateEmailNotification(userId, request, jwt != null ? jwt.getSubject() : null)));
    }

    @PatchMapping("/users/{userId}/status")
    public ResponseEntity<AppResponse<UserResponse>> updateUserStatus(
            @PathVariable String userId,
            @Valid @RequestBody UpdateUserStatusRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(AppResponse.success(
                "User status updated successfully",
                userService.updateUserStatus(userId, request, jwt != null ? jwt.getSubject() : null)));
    }

    @GetMapping("/packages")
    public ResponseEntity<AppResponse<List<AdminPackageResponse>>> getActivePackages() {
        return ResponseEntity.ok(AppResponse.success(
                "Available packages loaded",
                userService.getActivePackages()));
    }

    @GetMapping("/billing")
    public ResponseEntity<AppResponse<List<InvoiceResponse>>> getBillingHistory(
            @AuthenticationPrincipal Jwt jwt) {
        String tenantId = userService.getCurrentUser(jwt.getSubject()).getTenantId();
        return ResponseEntity.ok(AppResponse.success(
                "Billing history loaded",
                billingService.getTenantInvoices(tenantId)));
    }

    @PutMapping("/org")
    public ResponseEntity<AppResponse<TenantResponse>> updateMyOrg(
            @Valid @RequestBody UpdateOrgRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(AppResponse.success(
                "Organisation details updated successfully",
                userService.updateMyOrg(jwt.getSubject(), request)));
    }

    @PutMapping("/users/{subId}")
    public ResponseEntity<AppResponse<UserResponse>> updateUser(
            @PathVariable String subId,
            @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(AppResponse.success(
                "User updated successfully",
                userService.updateUser(subId, request)));
    }

    /**
     * Permanently delete a user from both the database and Cognito. The path value may be
     * the user's id, Cognito sub, or email. The organisation's primary-contact account
     * (whose email matches the tenant's email) cannot be deleted; any other user can.
     */
    @DeleteMapping("/users/{identifier}")
    public ResponseEntity<AppResponse<Void>> deleteUser(@PathVariable String identifier) {
        userService.deleteUser(identifier);
        return ResponseEntity.ok(AppResponse.success("User deleted successfully."));
    }
}
