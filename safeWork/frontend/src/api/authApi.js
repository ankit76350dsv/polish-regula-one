// SafeWork authentication API — SSO (single sign-on) model.
//
// HOW LOGIN WORKS NOW (same pattern as KSeFFlow):
//   1. SafeWork does NOT have its own email/password form anymore.
//   2. When the user is not logged in, we send the browser to the central
//      RegulaOne login page (running on port 3000).
//   3. After the user signs in there, RegulaOne sets a secure HttpOnly cookie
//      that is shared across all "localhost" apps, and sends the browser back
//      to SafeWork's SSO callback page.
//   4. SafeWork then calls /api/auth/me with the cookie to load the user.
//
// The token lives only inside the HttpOnly cookie, so JavaScript (and any XSS
// attacker) can never read it. We never use localStorage or an Authorization
// header anymore.

// These addresses follow whatever host the browser used to open SafeWork, so the app works
// on http://localhost:3002 AND on http://<machine-ip>:3002 for the rest of the team.
// See src/config/serviceUrls.js for why that matters.
import {
  REGULAONE_API_URL,
  APP_URL,
  CENTRAL_LOGIN_URL,
} from "../config/serviceUrls";

// RegulaOne backend — owns auth/me, login and logout. Port 8080.
const API_BASE_URL = `${REGULAONE_API_URL}/api`;

// After a successful central login, RegulaOne sends the user back to this page.
export const SSO_CALLBACK_URL = `${APP_URL}/auth/sso-callback`;

// Sends the browser to the central RegulaOne login page.
// We pass our SSO callback as `redirect_uri` so the user is returned here
// after they sign in.
export const redirectToCentralLogin = () => {
  const returnTo = encodeURIComponent(SSO_CALLBACK_URL);
  window.location.href = `${CENTRAL_LOGIN_URL}?redirect_uri=${returnTo}`;
};

// Returns the user object directly so AuthContext / Redux store get a clean shape.
// Backend wraps all responses in { success, data, message } — unwrap here.
export const getMe = async () => {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "GET",
    // Send the shared auth cookie with the request.
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("User is not authenticated");
  }

  const json = await response.json();
  // Extract just the user object so state.auth.user.tenantId works directly
  return json?.data?.user ?? json?.data ?? json;
};

// Logs the user out by asking the RegulaOne backend to clear the auth cookies.
// POST /api/sso/logout returns { logoutUrl } — the central page to land on.
// We send credentials so the server can see and clear the current session cookie.
export const logoutUser = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/sso/logout`, {
      method: "POST",
      credentials: "include",
    });
    const json = await response.json().catch(() => ({}));
    // Unwrap the AppResponse envelope to read logoutUrl.
    const data = json?.data ?? json;
    return data?.logoutUrl ?? CENTRAL_LOGIN_URL;
  } catch {
    // Even if the network call fails, fall back to the central login page so
    // the user always ends up somewhere safe.
    return CENTRAL_LOGIN_URL;
  }
};
