package com.regulaone.backend.services;

import com.regulaone.backend.configs.SSOConfig;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * SSO business logic — cookie management and cross-app login redirect building.
 *
 * All cookie writing is centralised here so the same SameSite / Secure / Domain
 * settings from SSOConfig are applied consistently across every endpoint that
 * sets or clears auth cookies (login, respond-challenge, refresh, logout).
 *
 * Cross-app login flow:
 *   1. Module app has no session → GET /api/sso/login?redirect_uri=...&state=...
 *   2. SSOController calls buildCentralLoginRedirectUrl → 302 to central login
 *   3. User fills in the login form on the central app
 *   4. AuthController sets shared-domain cookies via setCookie()
 *   5. Frontend reads ?redirect_uri and navigates back to the module app
 *   6. Module app calls GET /api/auth/me → authenticated
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SSOService {

    private final SSOConfig ssoConfig;

    // ── Cookie management ─────────────────────────────────────────────────────
    // These methods are the single source of truth for auth cookie settings.
    // Used by AuthController for login, respond-challenge, refresh, and logout.

    /**
     * Writes an HTTP-only auth cookie to the response.
     * Domain, Secure, and SameSite attributes are read from SSOConfig so the
     * same method works for both local dev and production.
     */
    public void setCookie(HttpServletResponse response, String name, String value, Integer maxAge) {
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(ssoConfig.isCookieSecure())
                .path("/")
                .maxAge(maxAge != null ? maxAge : 3600)
                .sameSite(ssoConfig.getCookieSameSite());

        if (ssoConfig.hasSharedDomain()) {
            builder.domain(ssoConfig.getCookieDomain());
        }

        response.addHeader(HttpHeaders.SET_COOKIE, builder.build().toString());
    }

    /**
     * Expires (clears) an auth cookie by setting MaxAge=0.
     * Must use the same Domain/Path attributes that were used when the cookie was set,
     * otherwise the browser will not match and delete it.
     */
    public void clearCookie(HttpServletResponse response, String name) {
        // Build base cookie configuration to expire the cookie (MaxAge=0)
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(name, "")
                .httpOnly(true)
                .secure(ssoConfig.isCookieSecure())
                .path("/")
                .maxAge(0)
                .sameSite(ssoConfig.getCookieSameSite());

        // Clear host-only cookie (no domain attribute)
        response.addHeader(HttpHeaders.SET_COOKIE, builder.build().toString());

        // Clear domain-scoped cookie (if shared domain is enabled)
        if (ssoConfig.hasSharedDomain()) {
            response.addHeader(HttpHeaders.SET_COOKIE, builder.domain(ssoConfig.getCookieDomain()).build().toString());
        }
    }

    // ── Central login redirect ────────────────────────────────────────────────

    /**
     * The URL of the central login page — used by the logout response and by
     * SSOController when building the cross-app redirect URL.
     */
    public String getCentralLoginUrl() {
        return ssoConfig.getCentralLoginUrl();
    }

    /**
     * Builds the URL for the central login page, embedding the originating
     * app's callback URI and state as query parameters so they survive the
     * redirect round-trip.
     *
     * Example result:
     *   http://localhost:3000/login
     *     ?sso=1
     *     &redirect_uri=http%3A%2F%2Flocalhost%3A3001%2Fauth%2Fsso-callback
     *     &state=a3NlZmZsb3d8L2ludm9pY2Vz
     */
    public String buildCentralLoginRedirectUrl(String ssoCallbackUri, String state) {
        log.info("[SSOService] buildCentralLoginRedirectUrl — callbackUri={} state={}", ssoCallbackUri, state);
        return ssoConfig.getCentralLoginUrl()
            + "?sso=1"
            + "&redirect_uri=" + encode(ssoCallbackUri)
            + "&state="        + encode(state);
    }

    // ── State encoding ────────────────────────────────────────────────────────

    /**
     * Encodes appId and returnPath into a URL-safe Base64 string.
     * Format: "appId|returnPath"  e.g. "ksefflow|/invoices/123"
     */
    public String encodeState(String appId, String returnPath) {
        String raw = (appId      != null ? appId      : "unknown") + "|"
                   + (returnPath != null ? returnPath : "/");
        String encoded = Base64.getUrlEncoder().withoutPadding()
            .encodeToString(raw.getBytes(StandardCharsets.UTF_8));
        log.info("[SSOService] encodeState — appId={} returnPath={} → encoded={}", appId, returnPath, encoded);
        return encoded;
    }

    /**
     * Decodes the state string back into [appId, returnPath].
     * Returns ["unknown", "/"] on missing or malformed input so callers always
     * have a safe fallback redirect target.
     */
    public String[] decodeState(String state) {
        try {
            if (state == null || state.isBlank()) {
                log.warn("[SSOService] decodeState — state is null/blank, using defaults");
                return new String[]{"unknown", "/"};
            }
            byte[] decoded = Base64.getUrlDecoder().decode(state);
            String raw     = new String(decoded, StandardCharsets.UTF_8);
            String[] parts = raw.split("\\|", 2);
            String[] result = parts.length < 2 ? new String[]{parts[0], "/"} : parts;
            log.info("[SSOService] decodeState — appId={} returnPath={}", result[0], result[1]);
            return result;
        } catch (Exception e) {
            log.warn("[SSOService] decodeState — failed to decode state='{}': {}", state, e.getMessage());
            return new String[]{"unknown", "/"};
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
