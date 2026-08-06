package com.regulaone.backend.auth;

import com.regulaone.backend.common.AppResponse;
import com.regulaone.backend.auth.dto.ChangePasswordRequest;
import com.regulaone.backend.auth.dto.ConfirmSignupRequest;
import com.regulaone.backend.auth.dto.ForgotPasswordRequest;
import com.regulaone.backend.auth.dto.ResetPasswordRequest;
import com.regulaone.backend.auth.dto.SignupRequest;
import com.regulaone.backend.user.dto.UpdateProfileRequest;
import com.regulaone.backend.user.dto.UserResponse;
import com.regulaone.backend.user.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/**
 * Registration, the person's own profile, and passwords.
 *
 *   POST /api/auth/signup                   create an account
 *   POST /api/auth/confirm                  verify the e-mailed code
 *   POST /api/auth/resend-code              send that code again
 *   GET  /api/auth/me                       my profile
 *   PATCH /api/auth/me                      change my display name
 *   POST /api/auth/forgot-password          start a password recovery
 *   POST /api/auth/forgot-password/confirm  finish it with the e-mailed code
 *   PUT  /api/auth/change-password          change my password while signed in
 *
 * The COOKIE-based session flows (login, refresh, logout) live next door in
 * {@link SSOController} under /api/sso/*.
 *
 * The two "me" endpoints are profile reads/writes, so they delegate to the user domain
 * ({@link com.regulaone.backend.user.UserService}); everything else is a credential
 * operation and goes to {@link AuthService}.
 */
@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    // Profile reads/writes belong to the user domain, not to authentication.
    private final UserService userService;

    // ── Registration ──────────────────────────────────────────────────────────

    @PostMapping("/signup")
    public ResponseEntity<AppResponse<Void>> signup(@Valid @RequestBody SignupRequest request) {
        log.info("[AuthController] POST /signup — email={}", request.getEmail());
        authService.signup(request);
        return ResponseEntity.ok(AppResponse.success(
                "Account created! Check your email for the verification code."));
    }

    @PostMapping("/confirm")
    public ResponseEntity<AppResponse<Void>> confirm(@Valid @RequestBody ConfirmSignupRequest request) {
        log.info("[AuthController] POST /confirm — email={}", request.getEmail());
        authService.confirmSignup(request);
        return ResponseEntity.ok(AppResponse.success("Email verified! You can now log in."));
    }

    @PostMapping("/resend-code")
    public ResponseEntity<AppResponse<Void>> resendCode(@RequestParam String email) {
        log.info("[AuthController] POST /resend-code — email={}", email);
        authService.resendCode(email);
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

    @PostMapping("/forgot-password")
    public ResponseEntity<AppResponse<Void>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request) {
        // Never log the supplied address and always return the same success message;
        // this public endpoint must not disclose whether an account exists.
        authService.requestPasswordReset(request);
        log.info("[AuthController] Password-recovery request accepted");
        return ResponseEntity.ok(AppResponse.success(
                "If an eligible account exists, a password reset code has been sent."));
    }

    @PostMapping("/forgot-password/confirm")
    public ResponseEntity<AppResponse<Void>> resetPassword(
            @Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        log.info("[AuthController] Password reset completed successfully");
        return ResponseEntity.ok(AppResponse.success("Password reset successfully. You can now sign in."));
    }

    @PreAuthorize("isAuthenticated()")
    @PutMapping("/change-password")
    public ResponseEntity<AppResponse<Void>> changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            @CookieValue(name = "accessToken") String accessToken) {

        authService.changePassword(request, accessToken);
        log.info("[AuthController] /change-password — SUCCESS");
        return ResponseEntity.ok(AppResponse.success("Password changed successfully."));
    }
}
