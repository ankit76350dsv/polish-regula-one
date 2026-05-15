package com.regulaone.backend.controllers;

import com.regulaone.backend.dto.*;
import com.regulaone.backend.dto.Auth.ChangePasswordRequest;
import com.regulaone.backend.dto.Auth.ConfirmSignupRequest;
import com.regulaone.backend.dto.Auth.LoginRequest;
import com.regulaone.backend.dto.Auth.LoginResponse;
import com.regulaone.backend.dto.Auth.RespondChallengeRequest;
import com.regulaone.backend.dto.Auth.SignupRequest;
import com.regulaone.backend.dto.Auth.UserResponse;
import com.regulaone.backend.services.UserService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
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

    // OLD IMPLEMENTATION — Replaced because the original returned a plain MessageResponse which
    // forced the frontend to parse challenge data (challengeName, session, username) out of a
    // human-readable string ("Challenge required: X | session=Y | username=Z"), making the
    // frontend brittle. The new implementation returns a structured LoginResponse with a
    // machine-readable "status" field so the frontend can reliably branch on "SUCCESS" vs "CHALLENGE".
    //
    // @PostMapping("/login")
    // public ResponseEntity<MessageResponse> login(...) { ... legacy message-string approach ... }

    // NEW IMPLEMENTATION
    // Returns LoginResponse with:
    //   status="SUCCESS"   — tokens stored in HTTP-only cookies, frontend redirects to dashboard
    //   status="CHALLENGE" — challengeName/session/username present, frontend shows new-password form
    //   HTTP 400 with status="ERROR" — bad credentials or Cognito error
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(
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

                // Added: store username (email) in an httpOnly cookie alongside the tokens.
                // Cognito's REFRESH_TOKEN_AUTH flow requires a SECRET_HASH that is computed using
                // the username — without this we cannot silently refresh without asking the user to
                // type their email again. The email is not secret, but httpOnly prevents XSS reads.
                setCookie(response, "username",
                        request.getEmail(),
                        30 * 24 * 60 * 60);

                return ResponseEntity.ok(
                        LoginResponse.builder()
                                .status("SUCCESS")
                                .message("Login successful")
                                .build());
            }

            // Cognito challenge (e.g. NEW_PASSWORD_REQUIRED for invited/temporary-password users)
            return ResponseEntity.ok(
                    LoginResponse.builder()
                            .status("CHALLENGE")
                            .challengeName(loginResponse.getChallengeName())
                            .session(loginResponse.getSession())
                            .username(loginResponse.getUsername())
                            .build());

        } catch (IllegalArgumentException e) {

            return ResponseEntity.badRequest()
                    .body(LoginResponse.builder()
                            .status("ERROR")
                            .message(e.getMessage())
                            .build());
        }
    }

    // OLD IMPLEMENTATION — Replaced to return consistent LoginResponse structure instead of
    // MessageResponse, so the frontend can use a single response type for all auth outcomes.
    //
    // @PostMapping("/respond-challenge")
    // public ResponseEntity<MessageResponse> respondToChallenge(...) {
    //     ...
    //     return ResponseEntity.ok(new MessageResponse("Password set. Login successful."));
    // }

    // NEW IMPLEMENTATION — Returns LoginResponse with status="SUCCESS" after setting cookies.
    @PostMapping("/respond-challenge")
    public ResponseEntity<LoginResponse> respondToChallenge(
            @Valid @RequestBody RespondChallengeRequest request,
            HttpServletResponse response) {

        LoginResponse loginResponse = userService.respondToChallenge(request);
        setCookie(response, "idToken", loginResponse.getIdToken(), loginResponse.getExpiresIn());
        setCookie(response, "accessToken", loginResponse.getAccessToken(), loginResponse.getExpiresIn());
        setCookie(response, "refreshToken", loginResponse.getRefreshToken(), 30 * 24 * 60 * 60);
        // Added: same username cookie as in /login — needed for silent refresh (see /refresh endpoint)
        setCookie(response, "username", request.getUsername(), 30 * 24 * 60 * 60);
        return ResponseEntity.ok(LoginResponse.builder()
                .status("SUCCESS")
                .message("Password set. Login successful.")
                .build());
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/me")
    public ResponseEntity<UserResponse> me(@AuthenticationPrincipal Jwt jwt) {
    //! @AuthenticationPrincipal Jwt jwt
    //? means:
    // "Spring, give me the current logged-in user's JWT"
        return ResponseEntity.ok(userService.getCurrentUser(jwt.getSubject()));
    }

    @PreAuthorize("isAuthenticated()")
    @PutMapping("/change-password")
    public ResponseEntity<MessageResponse> changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            @CookieValue(name = "accessToken") String accessToken) {

        userService.changePassword(request, accessToken);
        return ResponseEntity.ok(new MessageResponse("Password changed successfully"));
    }

    // Added: silent token refresh endpoint.
    // Called automatically by the frontend when any request returns 401 (idToken/accessToken expired).
    // Reads the refreshToken and username HTTP-only cookies set during login.
    // On success: issues new idToken + accessToken cookies (same 1-hour TTL).
    // On failure (refresh token expired/revoked): clears all cookies and returns 401 so the frontend
    //   redirects the user to /login.
    // No @PreAuthorize — the request intentionally has no valid idToken at this point.
    @PostMapping("/refresh")
    public ResponseEntity<MessageResponse> refresh(
            @CookieValue(name = "refreshToken", required = false) String refreshToken,
            @CookieValue(name = "username",     required = false) String username,
            HttpServletResponse response) {

        if (refreshToken == null || username == null) {
            return ResponseEntity.status(401)
                    .body(new MessageResponse("Session expired. Please log in again."));
        }

        try {
            LoginResponse loginResponse = userService.refreshTokens(refreshToken, username);
            setCookie(response, "idToken",      loginResponse.getIdToken(),      loginResponse.getExpiresIn());
            setCookie(response, "accessToken",  loginResponse.getAccessToken(),  loginResponse.getExpiresIn());
            return ResponseEntity.ok(new MessageResponse("Tokens refreshed"));
        } catch (IllegalArgumentException e) {
            // Refresh token is expired or revoked — force full re-login
            clearCookie(response, "idToken");
            clearCookie(response, "accessToken");
            clearCookie(response, "refreshToken");
            clearCookie(response, "username");
            return ResponseEntity.status(401)
                    .body(new MessageResponse(e.getMessage()));
        }
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/logout")
    public ResponseEntity<MessageResponse> logout(HttpServletResponse response) {
        clearCookie(response, "idToken");
        clearCookie(response, "accessToken");
        clearCookie(response, "refreshToken");
        clearCookie(response, "username");
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
