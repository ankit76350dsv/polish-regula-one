package com.regulaone.backend.auth;

import com.regulaone.backend.config.SSOConfig;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * SSO business logic — the browser session cookies, and the cross-app login redirect.
 *
 * All cookie writing is centralised here so the same SameSite / Secure / Domain
 * settings from SSOConfig are applied consistently by every endpoint that sets or
 * clears auth cookies (login, respond-challenge, refresh, logout).
 *
 * ── THE FOUR COOKIES OF A SESSION ───────────────────────────────────────────────
 *
 *   idToken       who the person is — the token every later request is verified against
 *   accessToken   used for Cognito operations the person performs on themselves
 *   refreshToken  long-lived; buys a new idToken without asking for the password again
 *   username      the e-mail, so a refresh knows whose token to renew
 *
 * All four are HTTP-only, so page scripts cannot read them (an XSS bug then cannot
 * steal a session). They are written together by {@link #issueSessionCookies} and
 * removed together by {@link #clearSessionCookies} — one call each, so no endpoint can
 * accidentally set three of the four and leave a half-built session behind.
 *
 * Cross-app login flow:
 *   1. Module app has no session → GET /api/sso/login?redirect_uri=...&state=...
 *   2. SSOController calls buildCentralLoginRedirectUrl → 302 to central login
 *   3. User fills in the login form on the central app
 *   4. The login endpoint writes the shared-domain cookies via issueSessionCookies()
 *   5. Frontend reads ?redirect_uri and navigates back to the module app
 *   6. Module app calls GET /api/auth/me → authenticated
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SSOService {

    /** How long the refresh token (and the username that goes with it) lives: 30 days. */
    private static final int REFRESH_TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

    private static final String ID_TOKEN = "idToken";
    private static final String ACCESS_TOKEN = "accessToken";
    private static final String REFRESH_TOKEN = "refreshToken";
    private static final String USERNAME = "username";

    private final SSOConfig ssoConfig;

    // ── The session as one unit ───────────────────────────────────────────────

    /**
     * Start a session: write all four cookies.
     *
     * Called after a successful password login and after an invited user completes
     * their first-login password challenge. Both used to repeat the same four
     * {@code setCookie} calls with the same magic 30-day number; they now share this.
     *
     * @param username the person's e-mail, stored so a later refresh knows whose
     *                 tokens to renew
     */
    public void issueSessionCookies(HttpServletResponse response,
                                    String idToken,
                                    String accessToken,
                                    String refreshToken,
                                    Integer expiresIn,
                                    String username) {
        setCookie(response, ID_TOKEN, idToken, expiresIn);
        setCookie(response, ACCESS_TOKEN, accessToken, expiresIn);
        setCookie(response, REFRESH_TOKEN, refreshToken, REFRESH_TOKEN_MAX_AGE_SECONDS);
        setCookie(response, USERNAME, username, REFRESH_TOKEN_MAX_AGE_SECONDS);
    }

    /**
     * Renew only the two short-lived cookies.
     *
     * The refresh token and username are deliberately left untouched: the person is
     * still the same person, and their 30-day window is not extended by a refresh.
     */
    public void refreshSessionCookies(HttpServletResponse response,
                                      String idToken,
                                      String accessToken,
                                      Integer expiresIn) {
        setCookie(response, ID_TOKEN, idToken, expiresIn);
        setCookie(response, ACCESS_TOKEN, accessToken, expiresIn);
    }

    /**
     * End a session: remove all four cookies.
     *
     * Used on logout AND when a refresh is refused — a token that no longer works must
     * not be left in the browser to be retried forever.
     */
    public void clearSessionCookies(HttpServletResponse response) {
        clearCookie(response, ID_TOKEN);
        clearCookie(response, ACCESS_TOKEN);
        clearCookie(response, REFRESH_TOKEN);
        clearCookie(response, USERNAME);
    }

    // ── One cookie at a time ──────────────────────────────────────────────────
    // These two are the single source of truth for auth cookie attributes.

    /**
     * Writes an HTTP-only auth cookie to the response.
     * Domain, Secure, and SameSite attributes are read from SSOConfig so the
     * same method works for both local dev and production.
     */
    private void setCookie(HttpServletResponse response, String name, String value, Integer maxAge) {
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
    private void clearCookie(HttpServletResponse response, String name) {
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
     * The URL of the central login page, as seen by THIS caller.
     *
     * SIMPLE EXPLANATION OF THE PROBLEM THIS SOLVES:
     * The configured login address for local work is "http://localhost:3000/login".
     * "localhost" means "the computer I am using right now". That is correct for a
     * developer sitting at this machine, but WRONG for a tester on the same Wi-Fi who
     * opened the platform at, say, http://192.168.20.8:3000 — sending them to
     * "localhost" points them at their OWN phone or laptop, where nothing is running.
     * They saw a dead page whenever their session expired or they signed out.
     *
     * So for LOCAL addresses we keep the scheme, port and path of the configured URL
     * and swap in the address the request actually arrived on. A tester is sent back
     * to the machine they are really using, a developer on localhost still gets
     * localhost, and neither has to edit any file when the network address changes.
     *
     * SAFETY: the swap happens ONLY when BOTH addresses are private/local ones. In
     * production the configured URL is a real domain (https://app.regulaone.eu/login),
     * so this method returns it untouched and the browser-supplied Host header can
     * never be used to redirect a signed-out user to an attacker's site.
     *
     * @param request the incoming request, used only to read the address it came in on
     * @return the login URL to send this particular caller to
     */
    public String centralLoginUrlFor(HttpServletRequest request) {
        String configuredUrl = ssoConfig.getCentralLoginUrl();
        if (request == null) {
            return configuredUrl;
        }

        String requestHost = request.getServerName();

        try {
            URI configuredUri = new URI(configuredUrl);

            // Only rewrite a local address, and only towards another local address.
            if (!isLocalAddress(configuredUri.getHost()) || !isLocalAddress(requestHost)) {
                return configuredUrl;
            }

            // Same scheme, same port, same path — only the host changes.
            String rewritten = new URI(
                    configuredUri.getScheme(),
                    null,
                    requestHost,
                    configuredUri.getPort(),
                    configuredUri.getPath(),
                    configuredUri.getQuery(),
                    configuredUri.getFragment()
            ).toString();

            if (!rewritten.equals(configuredUrl)) {
                log.debug("[SSOService] centralLoginUrlFor — local host rewrite {} → {}", configuredUrl, rewritten);
            }
            return rewritten;

        } catch (URISyntaxException e) {
            // A misconfigured value must not break signing out; use it as given.
            log.warn("[SSOService] centralLoginUrlFor — sso.central-login-url is not a valid URL, using it unchanged");
            return configuredUrl;
        }
    }

    /**
     * True when a host is this machine or a private office/home network address —
     * that is, an address that only exists inside the local network.
     *
     * These are the ranges reserved for private networks (RFC 1918) plus loopback:
     * 10.x, 172.16–172.31.x, 192.168.x, 127.x, and the names for "this computer".
     */
    private boolean isLocalAddress(String host) {
        if (host == null || host.isBlank()) {
            return false;
        }
        String lower = host.toLowerCase();
        if (lower.equals("localhost") || lower.equals("0.0.0.0") || lower.equals("[::1]") || lower.equals("::1")) {
            return true;
        }
        if (lower.startsWith("127.") || lower.startsWith("10.") || lower.startsWith("192.168.")) {
            return true;
        }
        if (lower.startsWith("172.")) {
            // 172.16.x – 172.31.x is private; 172.32.x and 172.15.x are NOT.
            String[] parts = lower.split("\\.");
            if (parts.length > 1) {
                try {
                    int secondOctet = Integer.parseInt(parts[1]);
                    return secondOctet >= 16 && secondOctet <= 31;
                } catch (NumberFormatException ignored) {
                    return false;
                }
            }
        }
        return false;
    }

    /**
     * Builds the URL for the central login page, embedding the originating
     * app's callback URI and state as query parameters so they survive the
     * redirect round-trip.
     *
     * The login page address is passed in (see {@link #centralLoginUrlFor}) so the
     * person is sent to the same address they are already using, rather than to a
     * fixed "localhost" that is only correct on the developer's own machine.
     *
     * Example result:
     *   http://localhost:3000/login
     *     ?sso=1
     *     &redirect_uri=http%3A%2F%2Flocalhost%3A3001%2Fauth%2Fsso-callback
     *     &state=a3NlZmZsb3d8L2ludm9pY2Vz
     */
    public String buildCentralLoginRedirectUrl(String centralLoginUrl, String ssoCallbackUri, String state) {
        log.info("[SSOService] buildCentralLoginRedirectUrl — loginUrl={} callbackUri={} state={}",
                centralLoginUrl, ssoCallbackUri, state);
        return centralLoginUrl
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
