/**
 * SSO configuration — read from Vite environment variables so the same
 * build can be deployed to local-dev, staging, and production by changing
 * only the .env file, not the source code.
 *
 * Environment variables (set in .env / .env.production / .env.staging):
 *
 *   VITE_API_URL          Base URL of the Spring Boot backend.
 *                         e.g. http://localhost:8080  (dev)
 *                              https://api.regulaone.eu  (prod)
 *
 *   VITE_APP_ID           Short identifier for this app within the ecosystem.
 *                         Used in the SSO state parameter so the auth service
 *                         knows which app initiated the login and where to
 *                         redirect the user after tokens are issued.
 *                         e.g. "regulaone" | "ksefflow" | "workpulse" | ...
 *
 *   VITE_APP_URL          Full base URL of this app (no trailing slash).
 *                         Used to build the sso-callback redirect URI.
 *                         e.g. http://localhost:3000  (dev)
 *                              https://ksefflow.regulaone.eu  (prod)
 *
 * All three have safe localhost defaults so local dev works without any .env file.
 */

export const SSO_API_URL = import.meta.env.VITE_API_URL  ?? 'http://localhost:8080';
export const SSO_APP_ID  = import.meta.env.VITE_APP_ID   ?? 'regulaone';
export const SSO_APP_URL = import.meta.env.VITE_APP_URL  ?? 'http://localhost:3000';

/** Full URL of the backend SSO login endpoint. */
export const SSO_LOGIN_ENDPOINT   = `${SSO_API_URL}/api/sso/login`;

/** Full URL of the backend logout endpoint (clears all auth cookies). */
export const SSO_LOGOUT_ENDPOINT  = `${SSO_API_URL}/api/sso/logout`;

/** Full URL of the backend session check endpoint. */
export const SSO_SESSION_ENDPOINT = `${SSO_API_URL}/api/auth/me`;

/**
 * The path within this app that handles the post-SSO redirect.
 * The browser is sent here after the auth service sets the shared-domain cookies.
 * SSOCallbackPage.jsx is mounted at this path.
 */
export const SSO_CALLBACK_PATH = '/auth/sso-callback';

/** Full URL of this app's SSO callback page (passed as redirect_uri to /api/sso/login). */
export const SSO_CALLBACK_URL = `${SSO_APP_URL}${SSO_CALLBACK_PATH}`;
