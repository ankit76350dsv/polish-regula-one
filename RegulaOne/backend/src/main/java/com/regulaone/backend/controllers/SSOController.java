package com.regulaone.backend.controllers;

import com.regulaone.backend.dto.MessageResponse;
import com.regulaone.backend.dto.Auth.LoginRequest;
import com.regulaone.backend.dto.Auth.LoginResponse;
import com.regulaone.backend.dto.Auth.RespondChallengeRequest;
import com.regulaone.backend.services.SSOService;
import com.regulaone.backend.services.UserService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * SSO controller — owns all cookie-based authentication flows.
 *
 * GET  /api/sso/login           — unauthenticated redirect to central login page
 * POST /api/sso/login           — authenticate with credentials, set session cookies
 * POST /api/sso/respond-challenge — complete NEW_PASSWORD_REQUIRED challenge
 * POST /api/sso/refresh         — silent token refresh via refreshToken cookie
 * POST /api/sso/logout          — clear all auth cookies, return logoutUrl
 *
 * All cookie read/write operations are delegated to SSOService which applies
 * the Domain / Secure / SameSite settings from SSOConfig consistently.
 *
 * User profile management (signup, /me, change-password) lives in AuthController.
 */
@Slf4j
@RestController
@RequestMapping("/api/sso")
@RequiredArgsConstructor
public class SSOController {

    private final SSOService  ssoService;
    private final UserService userService;

    // ── GET /api/sso/login ────────────────────────────────────────────────────
    // Unauthenticated entry point for module apps.
    // Redirects the browser to the central login page with redirect_uri and state
    // preserved as query params so the user lands back in the originating app.

    @GetMapping("/login")
    public void initiateSSO(
            @RequestParam(required = false) String redirect_uri,
            @RequestParam(required = false) String state,
            HttpServletResponse response) throws IOException {

        log.info("[SSOController] GET /api/sso/login — redirect_uri={} state={}", redirect_uri, state);

        String resolvedState = (state != null && !state.isBlank())
            ? state
            : ssoService.encodeState("unknown", "/");

        String callbackUri = (redirect_uri != null && !redirect_uri.isBlank())
            ? redirect_uri
            : ssoService.getCentralLoginUrl();

        String loginUrl = ssoService.buildCentralLoginRedirectUrl(callbackUri, resolvedState);
        log.info("[SSOController] /sso/login — 302 → {}", loginUrl);
        response.sendRedirect(loginUrl);
    }

    // ── POST /api/sso/login ───────────────────────────────────────────────────
    // Authenticates with Cognito and stores tokens in HTTP-only cookies.
    // Returns LoginResponse with:
    //   status="SUCCESS"   — cookies set, frontend → dashboard
    //   status="CHALLENGE" — NEW_PASSWORD_REQUIRED, frontend shows set-password form
    //   HTTP 400 status="ERROR" — bad credentials or Cognito error

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletResponse response) {

        log.info("[SSOController] POST /api/sso/login — email={}", request.getEmail());
        try {
            LoginResponse loginResponse = userService.login(request);

            if (loginResponse.getIdToken() != null) {
                // Tokens stored in HTTP-only cookies — never exposed to JavaScript.
                // SSOService applies the correct Domain/Secure/SameSite from SSOConfig.
                ssoService.setCookie(response, "idToken",      loginResponse.getIdToken(),      loginResponse.getExpiresIn());
                ssoService.setCookie(response, "accessToken",  loginResponse.getAccessToken(),  loginResponse.getExpiresIn());
                ssoService.setCookie(response, "refreshToken", loginResponse.getRefreshToken(), 30 * 24 * 60 * 60);
                // username cookie: Cognito REFRESH_TOKEN_AUTH requires a SECRET_HASH computed
                // from the username — store it so silent refresh works without re-prompting.
                ssoService.setCookie(response, "username",     request.getEmail(),              30 * 24 * 60 * 60);

                log.info("[SSOController] /sso/login — SUCCESS email={}", request.getEmail());
                return ResponseEntity.ok(LoginResponse.builder()
                        .status("SUCCESS")
                        .message("Login successful")
                        .build());
            }

            // Cognito challenge — e.g. NEW_PASSWORD_REQUIRED for invited/temp-password users
            log.info("[SSOController] /sso/login — CHALLENGE email={} challengeName={}",
                    request.getEmail(), loginResponse.getChallengeName());
            return ResponseEntity.ok(LoginResponse.builder()
                    .status("CHALLENGE")
                    .challengeName(loginResponse.getChallengeName())
                    .session(loginResponse.getSession())
                    .username(loginResponse.getUsername())
                    .build());

        } catch (IllegalArgumentException e) {
            log.warn("[SSOController] /sso/login — ERROR email={} reason={}", request.getEmail(), e.getMessage());
            return ResponseEntity.badRequest()
                    .body(LoginResponse.builder()
                            .status("ERROR")
                            .message(e.getMessage())
                            .build());
        }
    }

    // ── POST /api/sso/respond-challenge ───────────────────────────────────────
    // Completes the NEW_PASSWORD_REQUIRED challenge for invited / temp-password users.

    @PostMapping("/respond-challenge")
    public ResponseEntity<LoginResponse> respondToChallenge(
            @Valid @RequestBody RespondChallengeRequest request,
            HttpServletResponse response) {

        LoginResponse loginResponse = userService.respondToChallenge(request);
        ssoService.setCookie(response, "idToken",      loginResponse.getIdToken(),      loginResponse.getExpiresIn());
        ssoService.setCookie(response, "accessToken",  loginResponse.getAccessToken(),  loginResponse.getExpiresIn());
        ssoService.setCookie(response, "refreshToken", loginResponse.getRefreshToken(), 30 * 24 * 60 * 60);
        ssoService.setCookie(response, "username",     request.getUsername(),           30 * 24 * 60 * 60);

        log.info("[SSOController] /sso/respond-challenge — SUCCESS username={}", request.getUsername());
        return ResponseEntity.ok(LoginResponse.builder()
                .status("SUCCESS")
                .message("Password set. Login successful.")
                .build());
    }

    // ── POST /api/sso/refresh ─────────────────────────────────────────────────
    // Silent token refresh — called by the frontend when any request returns 401.
    // Reads the refreshToken + username HTTP-only cookies set at login.
    // No @PreAuthorize — the idToken is intentionally absent at this point.

    @PostMapping("/refresh")
    public ResponseEntity<MessageResponse> refresh(
            @CookieValue(name = "refreshToken", required = false) String refreshToken,
            @CookieValue(name = "username",     required = false) String username,
            HttpServletResponse response) {

        if (refreshToken == null || username == null) {
            log.warn("[SSOController] /sso/refresh — missing cookies, sending 401");
            return ResponseEntity.status(401)
                    .body(new MessageResponse("Session expired. Please log in again."));
        }

        // ResponseCookie URL-encodes @ → %40 in Set-Cookie; decode before passing to service.
        try {
            username = URLDecoder.decode(username, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException ignored) {}

        try {
            LoginResponse loginResponse = userService.refreshTokens(refreshToken, username);
            ssoService.setCookie(response, "idToken",     loginResponse.getIdToken(),     loginResponse.getExpiresIn());
            ssoService.setCookie(response, "accessToken", loginResponse.getAccessToken(), loginResponse.getExpiresIn());
            log.info("[SSOController] /sso/refresh — tokens refreshed for username={}", username);
            return ResponseEntity.ok(new MessageResponse("Tokens refreshed"));
        } catch (IllegalArgumentException e) {
            log.warn("[SSOController] /sso/refresh — token expired/revoked for username={} reason={}", username, e.getMessage());
            ssoService.clearCookie(response, "idToken");
            ssoService.clearCookie(response, "accessToken");
            ssoService.clearCookie(response, "refreshToken");
            ssoService.clearCookie(response, "username");
            return ResponseEntity.status(401)
                    .body(new MessageResponse(e.getMessage()));
        }
    }

    // ── POST /api/sso/logout ──────────────────────────────────────────────────
    // Clears all auth cookies and returns the central login URL for the redirect.
    // Because Domain=.regulaone.eu covers every subdomain, one call logs the user
    // out of ALL apps simultaneously.

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(HttpServletResponse response) {
        ssoService.clearCookie(response, "idToken");
        ssoService.clearCookie(response, "accessToken");
        ssoService.clearCookie(response, "refreshToken");
        ssoService.clearCookie(response, "username");
        log.info("[SSOController] /sso/logout — cookies cleared");
        return ResponseEntity.ok(Map.of(
                "message",   "Logged out successfully",
                "logoutUrl", ssoService.getCentralLoginUrl()));
    }
}
