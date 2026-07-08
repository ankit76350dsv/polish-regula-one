// WasteSync authentication API — SSO (single sign-on) model, identical to
// SafeWork / KSeFFlow.
//
// HOW LOGIN WORKS:
//   1. WasteSync has NO email/password form.
//   2. When the user is not logged in, we send the browser to the central
//      RegulaOne login page (port 3000).
//   3. After they sign in there, RegulaOne sets a secure HttpOnly cookie shared
//      across the localhost apps and returns the browser to our SSO callback.
//   4. WasteSync then calls /api/auth/me with the cookie to load the user.
//
// The token lives only inside the HttpOnly cookie, so JavaScript (and any XSS
// attacker) can never read it. We never use localStorage or Authorization headers.

// The central RegulaOne backend owns auth/me, login, and logout. Default :8080.
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8080") + "/api";

// This WasteSync app's own address. Default :3003 (see vite.config.js).
const APP_URL = import.meta.env.VITE_APP_URL ?? "http://localhost:3003";

// The central RegulaOne login page we redirect to. Default :3000.
const CENTRAL_LOGIN_URL =
  import.meta.env.VITE_CENTRAL_LOGIN_URL ?? "http://localhost:3000/login";

// After a successful central login, RegulaOne sends the user back to this page.
export const SSO_CALLBACK_URL = `${APP_URL}/auth/sso-callback`;

// Sends the browser to the central RegulaOne login page, passing our SSO
// callback as redirect_uri so the user is returned here after they sign in.
export const redirectToCentralLogin = () => {
  const returnTo = encodeURIComponent(SSO_CALLBACK_URL);
  window.location.href = `${CENTRAL_LOGIN_URL}?redirect_uri=${returnTo}`;
};

// Loads the current user. Returns the user object directly (unwrapped).
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

// Logs the user out by asking RegulaOne to clear the shared cookie. Returns the
// central page to land on afterwards.
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
    // Even if the call fails, fall back to the central login page so the user
    // always ends up somewhere safe.
    return CENTRAL_LOGIN_URL;
  }
};
