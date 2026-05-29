package com.regulaone.backend.controllers;

import com.regulaone.backend.dto.AppResponse;
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
 * All responses use AppResponse<T> so the frontend has a consistent envelope.
 * All cookie read/write operations are delegated to SSOService.
 */
@Slf4j
@RestController
@RequestMapping("/api/sso")
@RequiredArgsConstructor
public class SSOController {

    private final SSOService  ssoService;
    private final UserService userService;

    // ── GET /api/sso/login ────────────────────────────────────────────────────

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

    @PostMapping("/login")
    public ResponseEntity<AppResponse<LoginResponse>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletResponse response) {

        log.info("[SSOController] POST /api/sso/login — email={}", request.getEmail());
        try {
            LoginResponse loginResponse = userService.login(request);

            if (loginResponse.getIdToken() != null) {
                ssoService.setCookie(response, "idToken",      loginResponse.getIdToken(),      loginResponse.getExpiresIn());
                ssoService.setCookie(response, "accessToken",  loginResponse.getAccessToken(),  loginResponse.getExpiresIn());
                ssoService.setCookie(response, "refreshToken", loginResponse.getRefreshToken(), 30 * 24 * 60 * 60);
                ssoService.setCookie(response, "username",     request.getEmail(),              30 * 24 * 60 * 60);

                log.info("[SSOController] /sso/login — SUCCESS email={}", request.getEmail());
                return ResponseEntity.ok(AppResponse.success(
                        "Login successful",
                        LoginResponse.builder().status("SUCCESS").build()));
            }

            log.info("[SSOController] /sso/login — CHALLENGE email={} challengeName={}",
                    request.getEmail(), loginResponse.getChallengeName());
            return ResponseEntity.ok(AppResponse.success(
                    "Additional verification required",
                    LoginResponse.builder()
                            .status("CHALLENGE")
                            .challengeName(loginResponse.getChallengeName())
                            .session(loginResponse.getSession())
                            .username(loginResponse.getUsername())
                            .build()));

        } catch (IllegalArgumentException e) {
            log.warn("[SSOController] /sso/login — ERROR email={} reason={}", request.getEmail(), e.getMessage());
            return ResponseEntity.badRequest()
                    .body(AppResponse.error(e.getMessage(), "INVALID_CREDENTIALS", 400));
        }
    }

    // ── POST /api/sso/respond-challenge ───────────────────────────────────────

    @PostMapping("/respond-challenge")
    public ResponseEntity<AppResponse<Void>> respondToChallenge(
            @Valid @RequestBody RespondChallengeRequest request,
            HttpServletResponse response) {

        LoginResponse loginResponse = userService.respondToChallenge(request);
        ssoService.setCookie(response, "idToken",      loginResponse.getIdToken(),      loginResponse.getExpiresIn());
        ssoService.setCookie(response, "accessToken",  loginResponse.getAccessToken(),  loginResponse.getExpiresIn());
        ssoService.setCookie(response, "refreshToken", loginResponse.getRefreshToken(), 30 * 24 * 60 * 60);
        ssoService.setCookie(response, "username",     request.getUsername(),           30 * 24 * 60 * 60);

        log.info("[SSOController] /sso/respond-challenge — SUCCESS username={}", request.getUsername());
        return ResponseEntity.ok(AppResponse.success("Password set. Login successful."));
    }

    // ── POST /api/sso/refresh ─────────────────────────────────────────────────

    @PostMapping("/refresh")
    public ResponseEntity<AppResponse<Void>> refresh(
            @CookieValue(name = "refreshToken", required = false) String refreshToken,
            @CookieValue(name = "username",     required = false) String username,
            HttpServletResponse response) {

        if (refreshToken == null || username == null) {
            log.warn("[SSOController] /sso/refresh — missing cookies, sending 401");
            return ResponseEntity.status(401)
                    .body(AppResponse.error("Session expired. Please log in again.", "SESSION_EXPIRED", 401));
        }

        try {
            username = URLDecoder.decode(username, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException ignored) {}

        try {
            LoginResponse loginResponse = userService.refreshTokens(refreshToken, username);
            ssoService.setCookie(response, "idToken",     loginResponse.getIdToken(),     loginResponse.getExpiresIn());
            ssoService.setCookie(response, "accessToken", loginResponse.getAccessToken(), loginResponse.getExpiresIn());
            log.info("[SSOController] /sso/refresh — tokens refreshed for username={}", username);
            return ResponseEntity.ok(AppResponse.success("Tokens refreshed successfully."));
        } catch (IllegalArgumentException e) {
            log.warn("[SSOController] /sso/refresh — token expired/revoked for username={} reason={}", username, e.getMessage());
            ssoService.clearCookie(response, "idToken");
            ssoService.clearCookie(response, "accessToken");
            ssoService.clearCookie(response, "refreshToken");
            ssoService.clearCookie(response, "username");
            return ResponseEntity.status(401)
                    .body(AppResponse.error(e.getMessage(), "SESSION_EXPIRED", 401));
        }
    }

    // ── POST /api/sso/logout ──────────────────────────────────────────────────

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/logout")
    public ResponseEntity<AppResponse<Map<String, String>>> logout(HttpServletResponse response) {
        ssoService.clearCookie(response, "idToken");
        ssoService.clearCookie(response, "accessToken");
        ssoService.clearCookie(response, "refreshToken");
        ssoService.clearCookie(response, "username");
        log.info("[SSOController] /sso/logout — cookies cleared");
        return ResponseEntity.ok(AppResponse.success(
                "Logged out successfully",
                Map.of("logoutUrl", ssoService.getCentralLoginUrl())));
    }
}
