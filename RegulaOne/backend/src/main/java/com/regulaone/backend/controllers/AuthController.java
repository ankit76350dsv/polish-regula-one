package com.regulaone.backend.controllers;

import com.regulaone.backend.dto.*;
import com.regulaone.backend.dto.Auth.ChangePasswordRequest;
import com.regulaone.backend.dto.Auth.ConfirmSignupRequest;
import com.regulaone.backend.dto.Auth.LoginRequest;
import com.regulaone.backend.dto.Auth.LoginResponse;
import com.regulaone.backend.dto.Auth.RespondChallengeRequest;
import com.regulaone.backend.dto.Auth.SignupRequest;
import com.regulaone.backend.services.UserService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;

    @PostMapping("/signup")
    public ResponseEntity<MessageResponse> signup(@Valid @RequestBody SignupRequest request) {
        return ResponseEntity.ok(userService.signup(request));
    }

    @PostMapping("/confirm")
    public ResponseEntity<MessageResponse> confirm(@Valid @RequestBody ConfirmSignupRequest request) {
        return ResponseEntity.ok(userService.confirmSignup(request));
    }

    @PostMapping("/resend-code")
    public ResponseEntity<MessageResponse> resendCode(@RequestParam String email) {
        return ResponseEntity.ok(userService.resendCode(email));
    }

    @PostMapping("/login")
    public ResponseEntity<MessageResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletResponse response) {

        try {

            LoginResponse loginResponse = userService.login(request);

            if (loginResponse.getIdToken() != null) {

                // Tokens stored in HTTP-only cookies — never exposed to JavaScript
                setCookie(response, "idToken",
                        loginResponse.getIdToken(),
                        loginResponse.getExpiresIn());

                setCookie(response, "accessToken",
                        loginResponse.getAccessToken(),
                        loginResponse.getExpiresIn());

                setCookie(response, "refreshToken",
                        loginResponse.getRefreshToken(),
                        30 * 24 * 60 * 60);

                return ResponseEntity.ok(
                        new MessageResponse("Login successful"));
            }

            // Cognito challenge (e.g. NEW_PASSWORD_REQUIRED)
            return ResponseEntity.ok(
                    new MessageResponse(
                            "Challenge required: "
                                    + loginResponse.getChallengeName()
                                    + " | session=" + loginResponse.getSession()
                                    + " | username=" + loginResponse.getUsername()));

        } catch (IllegalArgumentException e) {

            return ResponseEntity.badRequest()
                    .body(new MessageResponse(e.getMessage()));
        }
    }

    @PostMapping("/respond-challenge")
    public ResponseEntity<MessageResponse> respondToChallenge(
            @Valid @RequestBody RespondChallengeRequest request,
            HttpServletResponse response) {

        LoginResponse loginResponse = userService.respondToChallenge(request);
        setCookie(response, "idToken", loginResponse.getIdToken(), loginResponse.getExpiresIn());
        setCookie(response, "accessToken", loginResponse.getAccessToken(), loginResponse.getExpiresIn());
        setCookie(response, "refreshToken", loginResponse.getRefreshToken(), 30 * 24 * 60 * 60);
        return ResponseEntity.ok(new MessageResponse("Password set. Login successful."));
    }

    @PreAuthorize("isAuthenticated()")
    @PutMapping("/change-password")
    public ResponseEntity<MessageResponse> changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            @CookieValue(name = "accessToken") String accessToken) {

        userService.changePassword(request, accessToken);
        return ResponseEntity.ok(new MessageResponse("Password changed successfully"));
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/logout")
    public ResponseEntity<MessageResponse> logout(HttpServletResponse response) {
        clearCookie(response, "idToken");
        clearCookie(response, "accessToken");
        clearCookie(response, "refreshToken");
        return ResponseEntity.ok(new MessageResponse("Logged out successfully"));
    }

    // ── Cookie helpers ────────────────────────────────────────────────────────

    private void setCookie(HttpServletResponse response, String name, String value, Integer maxAge) {
        ResponseCookie cookie = ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(false) // set true in production (HTTPS)
                .path("/")
                .maxAge(maxAge != null ? maxAge : 3600)
                .sameSite("Strict")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private void clearCookie(HttpServletResponse response, String name) {
        ResponseCookie cookie = ResponseCookie.from(name, "")
                .httpOnly(true)
                .secure(false)
                .path("/")
                .maxAge(0)
                .sameSite("Strict")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
