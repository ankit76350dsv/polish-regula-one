package com.regulaone.backend.controllers;

import com.regulaone.backend.dto.AppResponse;
import com.regulaone.backend.dto.Auth.UpdateEmailNotificationRequest;
import com.regulaone.backend.dto.Auth.UpdatePermissionsRequest;
import com.regulaone.backend.dto.Auth.UpdateUserStatusRequest;
import com.regulaone.backend.dto.Auth.UserResponse;
import com.regulaone.backend.dto.Platform.PlatformOverviewResponse;
import com.regulaone.backend.dto.Tenant.TeamManagementStatsResponse;
import com.regulaone.backend.services.PlatformService;
import com.regulaone.backend.services.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/superadmin")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
public class SuperAdminController {

    private final UserService     userService;
    private final PlatformService platformService;

    /**
     * The platform operator's business overview across every customer company.
     *
     * WHY THIS READ IS AUDITED (it was not before):
     *   Every other dashboard already writes an audit entry when it is opened, and this
     *   is the one that reaches across ALL customers. RegulaOne is a processor of its
     *   customers' data (GDPR Art. 28), and a processor has to be able to show what its
     *   own staff looked at — that is the point of Art. 5(2) accountability and of the
     *   audit clauses in a data-processing agreement. A customer asking "who at DSV
     *   looked at our account?" must get an answer from the trail, not from memory.
     *
     *   The entry carries no tenantId, because the read belongs to no single customer.
     *   That is what marks it as a platform-wide access in the trail.
     *
     * The audit write itself lives in PlatformService, which is where the other two
     * dashboards do theirs — the controller stays thin and does not reach for a
     * repository to resolve who is asking.
     *
     * The response holds commercial facts only — see PlatformOverviewResponse.
     */
    @GetMapping("/overview")
    public ResponseEntity<AppResponse<PlatformOverviewResponse>> getPlatformOverview(
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest request) {

        // jwt.getSubject() is the Cognito "sub" of the already-validated token — the
        // only identity input this endpoint accepts.
        return ResponseEntity.ok(AppResponse.success(
                "Platform overview loaded",
                platformService.getPlatformOverview(jwt.getSubject(), request)));
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
            @Valid @RequestBody UpdateUserStatusRequest request) {
        return ResponseEntity.ok(AppResponse.success(
                "User status updated successfully",
                userService.updateUserStatus(userId, request)));
    }

    // Update a user's cross-app permission codes from the platform-operator context.
    // Same UserService method the company-admin route uses, but this namespace requires
    // ROLE_SUPER_ADMIN — so this is the ONLY path that may grant/revoke platform-level codes
    // such as KSEF_PLATFORM_ADMIN (the company-admin route silently preserves those).
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
            @Valid @RequestBody UpdateEmailNotificationRequest request) {
        return ResponseEntity.ok(AppResponse.success(
                "User email notification preference updated successfully",
                userService.updateEmailNotification(userId, request)));
    }
}
