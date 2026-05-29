package com.regulaone.backend.controllers;

import com.regulaone.backend.dto.AppResponse;
import com.regulaone.backend.dto.Auth.ChangePasswordRequest;
import com.regulaone.backend.dto.Auth.ConfirmSignupRequest;
import com.regulaone.backend.dto.Auth.SignupRequest;
import com.regulaone.backend.dto.Auth.UpdateProfileRequest;
import com.regulaone.backend.dto.Auth.UserResponse;
import com.regulaone.backend.services.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/**
 * Auth controller — user registration, profile, and password management.
 * Cookie-based auth flows live in SSOController at /api/sso/*.
 */
@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;

    // ── Registration ──────────────────────────────────────────────────────────

    @PostMapping("/signup")
    public ResponseEntity<AppResponse<Void>> signup(@Valid @RequestBody SignupRequest request) {
        log.info("[AuthController] POST /signup — email={}", request.getEmail());
        userService.signup(request);
        return ResponseEntity.ok(AppResponse.success(
                "Account created! Check your email for the verification code."));
    }

    @PostMapping("/confirm")
    public ResponseEntity<AppResponse<Void>> confirm(@Valid @RequestBody ConfirmSignupRequest request) {
        log.info("[AuthController] POST /confirm — email={}", request.getEmail());
        userService.confirmSignup(request);
        return ResponseEntity.ok(AppResponse.success("Email verified! You can now log in."));
    }

    @PostMapping("/resend-code")
    public ResponseEntity<AppResponse<Void>> resendCode(@RequestParam String email) {
        log.info("[AuthController] POST /resend-code — email={}", email);
        userService.resendCode(email);
        return ResponseEntity.ok(AppResponse.success("Verification code resent. Check your inbox."));
    }

    // ── Profile ───────────────────────────────────────────────────────────────

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/me")
    public ResponseEntity<AppResponse<UserResponse>> me(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(AppResponse.success(
                "Profile loaded",
                userService.getCurrentUser(jwt.getSubject())));
    }

    @PreAuthorize("isAuthenticated()")
    @PatchMapping("/me")
    public ResponseEntity<AppResponse<UserResponse>> updateMe(
            @Valid @RequestBody UpdateProfileRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(AppResponse.success(
                "Profile updated successfully",
                userService.updateCurrentUserProfile(jwt.getSubject(), request)));
    }

    // ── Password ──────────────────────────────────────────────────────────────

    @PreAuthorize("isAuthenticated()")
    @PutMapping("/change-password")
    public ResponseEntity<AppResponse<Void>> changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            @CookieValue(name = "accessToken") String accessToken) {

        userService.changePassword(request, accessToken);
        log.info("[AuthController] /change-password — SUCCESS");
        return ResponseEntity.ok(AppResponse.success("Password changed successfully."));
    }
}
