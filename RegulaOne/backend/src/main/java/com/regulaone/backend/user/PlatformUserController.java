package com.regulaone.backend.user;

import com.regulaone.backend.common.AppResponse;
import com.regulaone.backend.user.dto.TeamManagementStatsResponse;
import com.regulaone.backend.user.dto.UpdateEmailNotificationRequest;
import com.regulaone.backend.user.dto.UpdatePermissionsRequest;
import com.regulaone.backend.user.dto.UpdateUserStatusRequest;
import com.regulaone.backend.user.dto.UserResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * USER ADMINISTRATION FROM THE PLATFORM OPERATOR'S SEAT — across every customer company.
 *
 *   GET   /api/superadmin/list-all-users                     everyone on the platform
 *   GET   /api/superadmin/tenants/{tenantId}/users           one company's staff
 *   GET   /api/superadmin/team-management                    platform-wide head count
 *   PATCH /api/superadmin/users/{userId}/status              activate / suspend anyone
 *   PATCH /api/superadmin/users/{userId}/permissions         grant / revoke any code
 *   PATCH /api/superadmin/users/{userId}/email-notification  their e-mail preference
 *
 * It is the platform-side twin of {@link AdminUserController}, and it calls the SAME two
 * services. The difference is not the code, it is the authority: these routes require
 * ROLE_SUPER_ADMIN, and that is what makes this the ONLY path that may grant or revoke
 * platform-level permission codes such as KSEF_PLATFORM_ADMIN — the company-admin route
 * silently preserves whatever the user already had.
 *
 * WHAT MOVED OUT (the URL is unchanged):
 *   GET /api/superadmin/overview  →  {@link com.regulaone.backend.dashboard.DashboardController},
 *   with the other two dashboards, since it is a reporting screen and not user
 *   administration.
 *
 * SECURITY: one audience, so the rule is stated ONCE at class level and repeated by
 * SecurityConfig's /api/superadmin/** rule. A new method here inherits it automatically.
 */
@RestController
@RequestMapping("/api/superadmin")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
public class PlatformUserController {

    private final UserService userService;
    private final UserAdminService userAdminService;

    // ── Reading ───────────────────────────────────────────────────────────────

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

    // ── Changing ──────────────────────────────────────────────────────────────

    /**
     * Activate or suspend any user.
     *
     * No acting administrator is passed: the operator sits outside every company, so the
     * "same organisation" and "not yourself" rules do not apply. The protections that DO
     * still apply are the company's owner account and its last active administrator.
     */
    @PatchMapping("/users/{userId}/status")
    public ResponseEntity<AppResponse<UserResponse>> updateUserStatus(
            @PathVariable String userId,
            @Valid @RequestBody UpdateUserStatusRequest request) {
        return ResponseEntity.ok(AppResponse.success(
                "User status updated successfully",
                userAdminService.updateUserStatus(userId, request)));
    }

    /**
     * Update a user's cross-app permission codes from the platform-operator context.
     *
     * Same service method the company-admin route uses, but this namespace requires
     * ROLE_SUPER_ADMIN — so this is the ONLY path that may grant or revoke platform-level
     * codes such as KSEF_PLATFORM_ADMIN.
     */
    @PatchMapping("/users/{userId}/permissions")
    public ResponseEntity<AppResponse<UserResponse>> updateUserPermissions(
            @PathVariable String userId,
            @RequestBody UpdatePermissionsRequest request) {
        return ResponseEntity.ok(AppResponse.success(
                "User permissions updated successfully",
                userAdminService.updateUserPermissions(userId, request)));
    }

    @PatchMapping("/users/{userId}/email-notification")
    public ResponseEntity<AppResponse<UserResponse>> updateUserEmailNotification(
            @PathVariable String userId,
            @Valid @RequestBody UpdateEmailNotificationRequest request) {
        return ResponseEntity.ok(AppResponse.success(
                "User email notification preference updated successfully",
                userAdminService.updateEmailNotification(userId, request)));
    }
}
