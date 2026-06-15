package com.regulaone.backend.configs;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * Centralizes every SSO-related setting.
 *
 * We do NOT use the Cognito Hosted UI or PKCE flow. Authentication always
 * happens through the custom RegulaOne login form using USER_PASSWORD_AUTH.
 * SSO is achieved purely through shared-domain HTTP-only cookies:
 *
 *   - Local dev  : domain="" → browser defaults to localhost
 *                  → cookies shared across localhost:3000, :3001, :3002, etc.
 *   - Production : domain=".regulaone.eu"
 *                  → cookies shared across every *.regulaone.eu subdomain
 *
 * Login flow (cross-app):
 *   1. Module app has no session → redirects browser to GET /api/sso/login
 *   2. Backend redirects to central login page with ?redirect_uri=<module-callback>
 *   3. User logs in on the central login form
 *   4. Backend sets shared-domain cookies
 *   5. useLogin hook sees ?redirect_uri → full-page redirect to module app
 *   6. Module app's SSOCallbackPage calls /api/auth/me → authenticated
 */
@Getter
@Configuration
public class SSOConfig {

    /**
     * The Domain attribute on every auth cookie.
     * Empty  → browser defaults to the exact host (localhost in dev).
     * ".regulaone.eu" → shared across all subdomains in production.
     */
    @Value("${sso.cookie.domain:}")
    private String cookieDomain;

    /**
     * Secure flag. false in local dev (HTTP), true in production (HTTPS).
     */
    @Value("${sso.cookie.secure:false}")
    private boolean cookieSecure;

    /**
     * SameSite attribute.
     * Lax — allows cookies on top-level cross-site navigation (email links etc.)
     * while blocking them on cross-site POST/XHR (CSRF safe).
     */
    @Value("${sso.cookie.same-site:Lax}")
    private String cookieSameSite;

    /**
     * The central login page URL. Module apps redirect unauthenticated users
     * here. After login, the shared-domain cookie is visible to all apps.
     * e.g. "https://app.regulaone.eu/login" in production.
     */
    @Value("${sso.central-login-url:http://localhost:3000/login}")
    private String centralLoginUrl;

    /** Returns true when a shared subdomain cookie domain is configured. */
    public boolean hasSharedDomain() {
        return cookieDomain != null && !cookieDomain.isBlank();
    }
}
