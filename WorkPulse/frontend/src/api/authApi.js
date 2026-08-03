// WorkPulse authentication API — SSO (single sign-on) model.
//
// HOW LOGIN WORKS (identical to SafeWork / KSeFFlow):
//   1. WorkPulse has NO email/password form of its own.
//   2. When the user is not logged in, we send the browser to the central
//      RegulaOne login page (running on port 3000).
//   3. After the user signs in there, RegulaOne sets a secure HttpOnly cookie
//      shared across all "localhost" apps and sends the browser back to
//      WorkPulse's SSO callback page.
//   4. WorkPulse then calls /api/auth/me with the cookie to load the user.
//
// The token lives only inside the HttpOnly cookie, so JavaScript (and any XSS
// attacker) can never read it. We never use localStorage or an Authorization
// header.

// RegulaOne backend — owns auth/me, login and logout. Default :8080.
const API_BASE_URL =
  (import.meta.env.VITE_API_URL ?? "http://localhost:8080") + "/api";

// This WorkPulse app's own address. Default :3005 (see vite.config.js).
const APP_URL = import.meta.env.VITE_APP_URL ?? "http://localhost:3005";

// The central RegulaOne login page the user is redirected to. Default :3000.
const CENTRAL_LOGIN_URL =
  import.meta.env.VITE_CENTRAL_LOGIN_URL ?? "http://localhost:3000/login";

// After a successful central login, RegulaOne returns the user to this page.
export const SSO_CALLBACK_URL = `${APP_URL}/auth/sso-callback`;

// Sends the browser to the central RegulaOne login page. We pass our SSO
// callback as `redirect_uri` so the user is returned here after signing in.
export const redirectToCentralLogin = () => {
  const returnTo = encodeURIComponent(SSO_CALLBACK_URL);
  window.location.href = `${CENTRAL_LOGIN_URL}?redirect_uri=${returnTo}`;
};

// Returns the user object directly so AuthContext / Redux get a clean shape.
// The backend wraps responses as { success, data, message } — unwrap here.
export const getMe = async () => {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "GET",
    credentials: "include", // send the shared auth cookie
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error("User is not authenticated");
  }

  const json = await response.json();
  return json?.data?.user ?? json?.data ?? json;
};

// Logs the user out by asking RegulaOne to clear the shared auth cookie.
// POST /api/sso/logout returns { logoutUrl } — the central page to land on.
export const logoutUser = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/sso/logout`, {
      method: "POST",
      credentials: "include",
    });
    const json = await response.json().catch(() => ({}));
    const data = json?.data ?? json;
    return data?.logoutUrl ?? CENTRAL_LOGIN_URL;
  } catch {
    // Even if the network call fails, land somewhere safe.
    return CENTRAL_LOGIN_URL;
  }
};
