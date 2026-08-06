package com.regulaone.backend.user;

import com.regulaone.backend.common.AppResponse;
import com.regulaone.backend.user.dto.UserResponse;
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
 * The staff list, as the OTHER RegulaOne applications read it.
 *
 *   GET /api/tenant/users — everyone in the caller's own organisation
 *
 * WHY THIS EXISTS SEPARATELY from the two admin controllers: identity lives in RegulaOne,
 * so the module apps (SafeVoice, KSeFFlow, WorkPulse, …) come here for their team lists.
 * It is open to ANY signed-in member, not just administrators, because a module app needs
 * the list to show who is on the team — so it keeps its own, narrower authorisation rule
 * instead of sharing an admin-only class.
 *
 * Each returned user carries their enabled modules and permission codes, so a module app
 * can show the whole team and visually highlight which members actually have access to
 * that module.
 *
 * The company id comes from the JWT, never from the client, so a caller can only ever see
 * their own organisation's members.
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TenantUserController {

    private final UserService userService;

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/tenant/users")
    public ResponseEntity<AppResponse<List<UserResponse>>> getTenantUsers(
            @AuthenticationPrincipal Jwt jwt) {
        String tenantId = userService.currentTenantId(jwt.getSubject());
        return ResponseEntity.ok(AppResponse.success(
                "Users loaded",
                userService.getTenantUsers(tenantId)));
    }
}
