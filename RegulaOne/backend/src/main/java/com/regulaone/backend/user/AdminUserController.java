package com.regulaone.backend.user;

import com.regulaone.backend.common.AppResponse;
import com.regulaone.backend.user.dto.InviteUserRequest;
import com.regulaone.backend.user.dto.TeamManagementStatsResponse;
import com.regulaone.backend.user.dto.UpdateEmailNotificationRequest;
import com.regulaone.backend.user.dto.UpdateModulesRequest;
import com.regulaone.backend.user.dto.UpdatePermissionsRequest;
import com.regulaone.backend.user.dto.UpdateUserRequest;
import com.regulaone.backend.user.dto.UpdateUserStatusRequest;
import com.regulaone.backend.user.dto.UserResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * TEAM MANAGEMENT for a company administrator — the staff of ONE organisation.
 *
 *   POST   /api/admin/users/invite                     add a colleague
 *   GET    /api/admin/users/{tenantId}                  the team list
 *   GET    /api/admin/team-management/{tenantId}        the header figures
 *   PATCH  /api/admin/users/{userId}/modules            which apps they may use
 *   PATCH  /api/admin/users/{userId}/permissions        what they may do inside those apps
 *   PATCH  /api/admin/users/{userId}/email-notification whether they get e-mails
 *   PATCH  /api/admin/users/{userId}/status             activate / suspend
 *   PUT    /api/admin/users/{subId}                      edit name, e-mail, role
 *   DELETE /api/admin/users/{identifier}                 remove permanently
 *
 * WHAT USED TO BE HERE AND MOVED (no URL changed):
 *   organisation setup and editing  →  {@link com.regulaone.backend.tenant.TenantController}
 *   plan comparison and invoices    →  {@link com.regulaone.backend.billing.SubscriptionController}
 *   the compliance overview         →  {@link com.regulaone.backend.dashboard.DashboardController}
 *   This file used to be a general "admin" bucket for all four subjects at once.
 *
 * ── SECURITY ────────────────────────────────────────────────────────────────────
 *
 * ONE audience, so the rule is stated ONCE at class level: every route here requires
 * ROLE_ADMIN, and SecurityConfig's /api/admin/** rule says the same thing again. Keep it
 * that way — a new method inherits the class rule and cannot be added unprotected.
 *
 * The acting administrator's own identity is passed to the service on every operation that
 * needs it, which is how the service enforces "same organisation only", "not the owner",
 * "not yourself" and "not the last admin". See {@link UserAdminService}.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminUserController {

    private final UserService userService;
    private final UserAdminService userAdminService;

    // ── The team ──────────────────────────────────────────────────────────────

    @PostMapping("/users/invite")
    public ResponseEntity<AppResponse<UserResponse>> inviteUser(
            @Valid @RequestBody InviteUserRequest request) {
        return ResponseEntity.ok(AppResponse.success(
                "User invited successfully. A temporary password has been sent to their email.",
                userAdminService.inviteUser(request)));
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

    // ── Access ────────────────────────────────────────────────────────────────

    /** Replaces the user's whole module list — the whole list is sent at once. */
    @PatchMapping("/users/{userId}/modules")
    public ResponseEntity<AppResponse<UserResponse>> updateUserModules(
            @PathVariable String userId,
            @RequestBody UpdateModulesRequest request) {
        return ResponseEntity.ok(AppResponse.success(
                "Module access updated successfully",
                userAdminService.updateUserModules(userId, request)));
    }

    /**
     * Replaces the user's cross-app permission codes (e.g. KSEF_AUDITOR). Same shape as
     * the modules endpoint above.
     *
     * Platform-level codes cannot be granted or revoked from here — see
     * UserAdminService's PROTECTED_PERMISSIONS.
     */
    @PatchMapping("/users/{userId}/permissions")
    public ResponseEntity<AppResponse<UserResponse>> updateUserPermissions(
            @PathVariable String userId,
            @RequestBody UpdatePermissionsRequest request) {
        return ResponseEntity.ok(AppResponse.success(
                "User permissions updated successfully",
                userAdminService.updateUserPermissions(userId, request)));
    }

    // ── Account state ─────────────────────────────────────────────────────────

    @PatchMapping("/users/{userId}/email-notification")
    public ResponseEntity<AppResponse<UserResponse>> updateUserEmailNotification(
            @PathVariable String userId,
            @Valid @RequestBody UpdateEmailNotificationRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(AppResponse.success(
                "User email notification preference updated successfully",
                userAdminService.updateEmailNotification(
                        userId, request, jwt != null ? jwt.getSubject() : null)));
    }

    @PatchMapping("/users/{userId}/status")
    public ResponseEntity<AppResponse<UserResponse>> updateUserStatus(
            @PathVariable String userId,
            @Valid @RequestBody UpdateUserStatusRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(AppResponse.success(
                "User status updated successfully",
                userAdminService.updateUserStatus(
                        userId, request, jwt != null ? jwt.getSubject() : null)));
    }

    @PutMapping("/users/{subId}")
    public ResponseEntity<AppResponse<UserResponse>> updateUser(
            @PathVariable String subId,
            @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(AppResponse.success(
                "User updated successfully",
                userAdminService.updateUser(subId, request)));
    }

    /**
     * Permanently delete a user from both the database and Cognito. The path value may be
     * the user's id, Cognito sub, or email. Deletion is limited to the authenticated
     * admin's tenant and protects the admin's own account, the primary contact, and the
     * tenant's last active administrator.
     */
    @DeleteMapping("/users/{identifier}")
    public ResponseEntity<AppResponse<Void>> deleteUser(
            @PathVariable String identifier,
            @AuthenticationPrincipal Jwt jwt) {
        userAdminService.deleteUser(identifier, jwt != null ? jwt.getSubject() : null);
        return ResponseEntity.ok(AppResponse.success("User deleted successfully."));
    }
}
