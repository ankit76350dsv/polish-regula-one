import { create } from 'zustand';
import { authService } from '../services/authService';

// ── Proactive token refresh ───────────────────────────────────────────────────
//
// Cognito idToken and accessToken expire after 1 hour. The backend sets the
// cookies with maxAge = expiresIn (3600 s), so the browser deletes them at
// exactly T+60 min. A reactive 401-then-refresh works for in-flight requests
// but NOT when the page is reloaded after the cookies are already gone.
//
// Fix: schedule a silent POST /api/auth/refresh 5 minutes before expiry.
// The backend reads the long-lived refreshToken cookie (30-day TTL) and
// issues fresh idToken + accessToken cookies. The user never sees a 401.
//
// Timeline:
//   T+0       login  →  idToken/accessToken expire at T+60
//   T+55 min  refresh → new idToken/accessToken expire at T+115
//   T+110 min refresh → new idToken/accessToken expire at T+170
//   …
//
const COGNITO_TOKEN_TTL_MS  = 60 * 60 * 1000; // 1 hour  (Cognito default)
const REFRESH_BEFORE_EXPIRY = 5  * 60 * 1000; // refresh 5 min before expiry
const REFRESH_INTERVAL_MS   = COGNITO_TOKEN_TTL_MS - REFRESH_BEFORE_EXPIRY; // 55 min

let _refreshTimer = null;

// Starts (or restarts) the 55-minute proactive refresh cycle.
// `onExpired` is called if the refresh token itself has expired — that triggers
// a forced logout so the user can re-authenticate.
function _startRefreshCycle(onExpired) {
  clearTimeout(_refreshTimer);
  _refreshTimer = setTimeout(async () => {
    try {
      await authService.refresh();
      // New cookies set — start the next 55-minute window
      _startRefreshCycle(onExpired);
    } catch {
      // Refresh token expired (30-day TTL reached) — force re-login
      onExpired();
    }
  }, REFRESH_INTERVAL_MS);
}

function _stopRefreshCycle() {
  clearTimeout(_refreshTimer);
  _refreshTimer = null;
}

// ── Profile mapping ───────────────────────────────────────────────────────────

// Maps the backend UserApiResponse shape to the frontend UserProfile shape.
// Centralised here so all hooks/pages get consistent user objects.
export function mapApiUserToProfile(res) {
  return {
    uid:          res.id,
    email:        res.email,
    displayName:  res.name,
    role:         res.role,
    status:       res.enabled ? 'active' : 'suspended',
    // Tenant fields — null until the admin completes org setup.
    // Used by DashboardLayout to decide which modal to show.
    tenantId:     res.tenantId     ?? null,
    tenantName:   res.tenantName   ?? null,
    tenantStatus: res.tenantStatus ?? null,
    // Plan expiry — null/false when no package is assigned
    planExpiresAt:    res.planExpiresAt    ?? null,
    planExpired:      res.planExpired      ?? false,
    planExpiringSoon: res.planExpiringSoon ?? false,
    // Package and module access — used by the sidebar to show/hide modules
    // and by the profile page to display what the user can access.
    packageId: res.packageId ?? null,
    moduleIds: res.moduleIds ?? [],
  };
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAuthStore = create((set) => ({
  user:           null,
  isLoading:      true,  // true on boot while we try to restore the session
  challengeState: null,

  // setUser: called by login, challenge response, and logout flows.
  // Starting/stopping the refresh cycle here ensures it is always in sync with
  // whether there is an authenticated user, regardless of how the user was set.
  setUser: (user) => {
    set({ user });
    if (user) {
      _startRefreshCycle(() => set({ user: null }));
    } else {
      _stopRefreshCycle();
    }
  },

  setLoading:        (isLoading)      => set({ isLoading }),
  setChallengeState: (challengeState) => set({ challengeState }),

  // initAuth: restores session from the idToken HTTP-only cookie on every page
  // load. If the cookie has already expired, api.js intercepts the 401, calls
  // /api/auth/refresh, and retries — so the user stays logged in even on reload
  // after exactly 1 hour. On success, the 55-minute proactive cycle starts.
  initAuth: async () => {
    set({ isLoading: true });
    try {
      const me = await authService.getMe();
      set({ user: mapApiUserToProfile(me), isLoading: false });
      _startRefreshCycle(() => set({ user: null }));
    } catch {
      // 401 (no valid session) or network error — stay logged out
      set({ user: null, isLoading: false });
    }
  },
}));
