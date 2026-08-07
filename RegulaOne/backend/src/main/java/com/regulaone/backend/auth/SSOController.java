package com.regulaone.backend.auth;

import com.regulaone.backend.auth.dto.LoginRequest;
import com.regulaone.backend.auth.dto.LoginResponse;
import com.regulaone.backend.auth.dto.RespondChallengeRequest;
import com.regulaone.backend.common.AppResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * The cookie-based session: signing in, staying in, and signing out.
 *
 * GET  /api/sso/login             — unauthenticated redirect to the central login page
 * POST /api/sso/login             — authenticate with credentials, start the session
 * POST /api/sso/respond-challenge — complete NEW_PASSWORD_REQUIRED on a first login
 * POST /api/sso/refresh           — silent token renewal via the refreshToken cookie
 * POST /api/sso/logout            — end the session, return the central logout URL
 *
 * All responses use AppResponse&lt;T&gt; so the frontend has a consistent envelope.
 *
 * NO COOKIE IS BUILT HERE. Every session cookie is written or removed by
 * {@link SSOService}, as a complete set, so the Secure / SameSite / Domain attributes
 * and the token lifetimes are decided in exactly one place. This controller only says
 * WHEN a session starts, is renewed, or ends.
 */
@Slf4j
@RestController
@RequestMapping("/api/sso")
@RequiredArgsConstructor
public class SSOController {

    private final SSOService  ssoService;
    private final AuthService authService;

    // ── GET /api/sso/login ────────────────────────────────────────────────────

    /**
     * Send a browser that has no session to the central login page, remembering where
     * it came from so it can be sent back afterwards.
     */
    @GetMapping("/login")
    public void initiateSSO(
            @RequestParam(required = false) String redirect_uri,
            @RequestParam(required = false) String state,
            HttpServletRequest request,
            HttpServletResponse response) throws IOException {

        log.info("[SSOController] GET /api/sso/login — redirect_uri={} state={}", redirect_uri, state);

        String resolvedState = (state != null && !state.isBlank())
            ? state
            : ssoService.encodeState("unknown", "/");

        // The login page for THIS caller: on a developer machine that is localhost, and
        // for a tester on the office Wi-Fi it is the network address they opened the
        // platform on. See SSOService.centralLoginUrlFor for why this matters.
        String centralLoginUrl = ssoService.centralLoginUrlFor(request);

        String callbackUri = (redirect_uri != null && !redirect_uri.isBlank())
            ? redirect_uri
            : centralLoginUrl;

        String loginUrl = ssoService.buildCentralLoginRedirectUrl(centralLoginUrl, callbackUri, resolvedState);
        log.info("[SSOController] /sso/login — 302 → {}", loginUrl);
        response.sendRedirect(loginUrl);
    }

    // ── POST /api/sso/login ───────────────────────────────────────────────────

    /**
     * Sign in with e-mail and password.
     *
     * Two possible outcomes: a full session (tokens issued as cookies), or a CHALLENGE —
     * an invited user logging in for the first time must set their own password before
     * they get a session. In the challenge case NO cookie is written; the frontend sends
     * the answer to /respond-challenge.
     */
    @PostMapping("/login")
    public ResponseEntity<AppResponse<LoginResponse>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletResponse response) {

        log.info("[SSOController] POST /api/sso/login — email={}", request.getEmail());
        try {
            LoginResponse loginResponse = authService.login(request);

            if (loginResponse.getIdToken() != null) {
                ssoService.issueSessionCookies(response,
                        loginResponse.getIdToken(),
                        loginResponse.getAccessToken(),
                        loginResponse.getRefreshToken(),
                        loginResponse.getExpiresIn(),
                        request.getEmail());

                log.info("[SSOController] /sso/login — SUCCESS email={}", request.getEmail());
                // Only the status is returned: the tokens themselves stay in HTTP-only
                // cookies and are never handed to page scripts.
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

    /** Set the new password an invited user was asked for, and start their session. */
    @PostMapping("/respond-challenge")
    public ResponseEntity<AppResponse<Void>> respondToChallenge(
            @Valid @RequestBody RespondChallengeRequest request,
            HttpServletResponse response) {

        LoginResponse loginResponse = authService.respondToChallenge(request);
        ssoService.issueSessionCookies(response,
                loginResponse.getIdToken(),
                loginResponse.getAccessToken(),
                loginResponse.getRefreshToken(),
                loginResponse.getExpiresIn(),
                request.getUsername());

        log.info("[SSOController] /sso/respond-challenge — SUCCESS username={}", request.getUsername());
        return ResponseEntity.ok(AppResponse.success("Password set. Login successful."));
    }

    // ── POST /api/sso/refresh ─────────────────────────────────────────────────

    /**
     * Renew an expiring session without asking for the password again.
     *
     * If the refresh token is gone, expired or revoked, EVERY session cookie is cleared
     * before answering 401 — a dead token left in the browser would be retried forever.
     */
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
        } catch (IllegalArgumentException ignored) {
            // A cookie that is not percent-encoded is used exactly as it was stored.
        }

        try {
            LoginResponse loginResponse = authService.refreshTokens(refreshToken, username);
            ssoService.refreshSessionCookies(response,
                    loginResponse.getIdToken(),
                    loginResponse.getAccessToken(),
                    loginResponse.getExpiresIn());
            log.info("[SSOController] /sso/refresh — tokens refreshed for username={}", username);
            return ResponseEntity.ok(AppResponse.success("Tokens refreshed successfully."));
        } catch (IllegalArgumentException e) {
            log.warn("[SSOController] /sso/refresh — token expired/revoked for username={} reason={}", username, e.getMessage());
            ssoService.clearSessionCookies(response);
            return ResponseEntity.status(401)
                    .body(AppResponse.error(e.getMessage(), "SESSION_EXPIRED", 401));
        }
    }

    // ── POST /api/sso/logout ──────────────────────────────────────────────────

    /**
     * End the session here, and tell the browser where the central logout page is.
     *
     * The address returned is the one the caller is actually using: a tester who signed
     * in over the office Wi-Fi is sent back to that same address, not to "localhost",
     * which for them means their own device where nothing is running.
     */
    @PreAuthorize("isAuthenticated()")
    @PostMapping("/logout")
    public ResponseEntity<AppResponse<Map<String, String>>> logout(
            HttpServletRequest request,
            HttpServletResponse response) {
        ssoService.clearSessionCookies(response);
        log.info("[SSOController] /sso/logout — cookies cleared");
        return ResponseEntity.ok(AppResponse.success(
                "Logged out successfully",
                Map.of("logoutUrl", ssoService.centralLoginUrlFor(request))));
    }
}
