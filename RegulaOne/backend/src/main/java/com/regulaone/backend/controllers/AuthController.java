package com.regulaone.backend.controllers;

import com.regulaone.backend.dto.*;
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
 *
 * Cookie-based authentication flows (login, respond-challenge, refresh, logout)
 * live in SSOController at /api/sso/*.
 *
 * Endpoints:
 *   POST  /api/auth/signup          — create Cognito user
 *   POST  /api/auth/confirm         — confirm email code
 *   POST  /api/auth/resend-code     — re-send verification code
 *   GET   /api/auth/me              — get authenticated user profile
 *   PATCH /api/auth/me              — update display name
 *   PUT   /api/auth/change-password — change password
 */
@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;

    // ── Registration ──────────────────────────────────────────────────────────

    @PostMapping("/signup")
    public ResponseEntity<MessageResponse> signup(@Valid @RequestBody SignupRequest request) {
        log.info("[AuthController] POST /signup — email={}", request.getEmail());
        return ResponseEntity.ok(userService.signup(request));
    }

    @PostMapping("/confirm")
    public ResponseEntity<MessageResponse> confirm(@Valid @RequestBody ConfirmSignupRequest request) {
        log.info("[AuthController] POST /confirm — email={}", request.getEmail());
        return ResponseEntity.ok(userService.confirmSignup(request));
    }

    @PostMapping("/resend-code")
    public ResponseEntity<MessageResponse> resendCode(@RequestParam String email) {
        log.info("[AuthController] POST /resend-code — email={}", email);
        return ResponseEntity.ok(userService.resendCode(email));
    }

    // ── Profile ───────────────────────────────────────────────────────────────

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/me")
    public ResponseEntity<UserResponse> me(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(userService.getCurrentUser(jwt.getSubject()));
    }

    @PreAuthorize("isAuthenticated()")
    @PatchMapping("/me")
    public ResponseEntity<UserResponse> updateMe(
            @Valid @RequestBody UpdateProfileRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(userService.updateCurrentUserProfile(jwt.getSubject(), request));
    }

    // ── Password ──────────────────────────────────────────────────────────────

    @PreAuthorize("isAuthenticated()")
    @PutMapping("/change-password")
    public ResponseEntity<MessageResponse> changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            @CookieValue(name = "accessToken") String accessToken) {

        userService.changePassword(request, accessToken);
        log.info("[AuthController] /change-password — SUCCESS");
        return ResponseEntity.ok(new MessageResponse("Password changed successfully"));
    }
}
