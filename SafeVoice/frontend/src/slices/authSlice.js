/**
 * Redux Toolkit slice for SafeVoice authentication (RegulaOne SSO).
 *
 * This slice is the single source of truth for "who is signed in and may they use
 * the staff area?". Components read it with useSelector and trigger changes by
 * dispatching the thunks below — they never call the network directly. This follows
 * the project's mandatory Redux Toolkit rules (loading / success / error all live here).
 *
 * Auth model (same as KSeFFlow): there is no password form. Identity comes from the
 * central RegulaOne session cookie. We just verify it (initSession) and clear it (signOut).
 */
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchMe, logout } from "../services/authService";
import {
  clearSsoRedirectGuard,
  redirectToLogin,
  CENTRAL_LOGIN_URL,
  SSO_CALLBACK_URL,
} from "../services/api";
import { USE_MOCK_AUTH } from "../config";
import mockApi from "../mock/mockApi";

// How long we wait for /api/auth/me before treating the backend as unreachable.
// Without this, a dead/wrong-host backend leaves the app stuck on the spinner forever.
const ME_TIMEOUT_MS = 8000;

// ── Mock "session" (development only) ─────────────────────────────────────────
// In mock mode there is no real SSO server, but we still want the app to behave
// like production: just opening a staff URL must NOT log you in automatically.
// So we keep a tiny per-tab flag that says "the demo user has signed in". Until
// that flag is set, the mock session check reports "not signed in" — exactly like
// arriving at the real app with no cookie. Signing in (signIn) sets it; signing
// out clears it. We use sessionStorage so a page refresh keeps you signed in
// within the same tab, but a fresh tab / direct link starts logged out.
const MOCK_SESSION_KEY = "safevoice_mock_session";

function mockSessionActive() {
  try {
    return sessionStorage.getItem(MOCK_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function setMockSession(active) {
  try {
    if (active) sessionStorage.setItem(MOCK_SESSION_KEY, "1");
    else sessionStorage.removeItem(MOCK_SESSION_KEY);
  } catch {
    /* sessionStorage may be unavailable (private mode) — ignore */
  }
}

// ── Thunks ────────────────────────────────────────────────────────────────────

/**
 * Verify the shared-domain SSO session on app load (and on Retry).
 *
 * Resolves with the mapped user on success. On failure we use rejectWithValue to
 * tell the reducer WHICH kind of failure it was:
 *   { kind: 'unauthenticated' } → clean "not signed in" → show the login redirect.
 *   { kind: 'transient', message } → network/timeout → show an error + Retry button.
 */
export const initSession = createAsyncThunk(
  "auth/initSession",
  async (_arg, { rejectWithValue }) => {
    // MOCK MODE: there is no real SSO backend while we build the UI. We only return
    // the demo user if a mock sign-in has actually happened — otherwise we report
    // "not signed in", so a staff URL opened without logging in is denied just like
    // in production. Flip VITE_USE_MOCK=false to use the real RegulaOne SSO instead.
    if (USE_MOCK_AUTH) {
      if (mockSessionActive()) return mockApi.me();
      return rejectWithValue({ kind: "unauthenticated" });
    }

    // Guard against a dead / slow / wrong-IP backend.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ME_TIMEOUT_MS);
    try {
      const user = await fetchMe(controller.signal);
      // The session is genuinely valid — safe to reset the redirect-loop counter.
      clearSsoRedirectGuard();
      return user;
    } catch (err) {
      const clean = err?.message === "not authenticated";
      if (clean) {
        return rejectWithValue({ kind: "unauthenticated" });
      }
      return rejectWithValue({
        kind: "transient",
        message:
          err?.name === "AbortError"
            ? "Could not reach the server. Check your connection and try again."
            : err?.message || "Could not verify your session.",
      });
    } finally {
      clearTimeout(timeout);
    }
  },
  {
    // Optimise API usage (one /me per app load, no polling): skip the network call
    // when a check is already in flight or the session is already verified. This is
    // what lets the landing page AND the staff area both ask for the session without
    // ever firing /api/auth/me twice. A real "Try again" still works because the
    // status is "error"/"unauthenticated" by then, which this condition allows.
    condition: (_arg, { getState }) => {
      const status = getState().auth.status;
      return status !== "loading" && status !== "authenticated";
    },
  },
);

/**
 * Sign in.
 *   MOCK MODE: there is no login form — establish the mock session flag and load
 *   the demo profile, so the user is now authenticated (and staff routes open up).
 *   REAL MODE: there is no in-app login either — hand off to the central RegulaOne
 *   login page (the browser leaves), exactly like the SSO redirect everywhere else.
 */
export const signIn = createAsyncThunk(
  "auth/signIn",
  async (_arg, { rejectWithValue }) => {
    if (USE_MOCK_AUTH) {
      setMockSession(true);
      return mockApi.me();
    }
    redirectToLogin();
    // The browser is navigating away; keep us "not signed in" until it returns.
    return rejectWithValue({ kind: "unauthenticated" });
  },
  {
    // Don't start a second sign-in while one is running or already done.
    condition: (_arg, { getState }) => {
      const status = getState().auth.status;
      return status !== "loading" && status !== "authenticated";
    },
  },
);

/**
 * End the SSO session and leave for the central logout/login page.
 * We always navigate away afterwards, even if the backend call fails, so the user
 * is never left in a half-signed-out state.
 */
export const signOut = createAsyncThunk("auth/signOut", async () => {
  // MOCK MODE: clear the mock session flag so the user is genuinely logged out
  // (the reducer below sets status → 'unauthenticated') and stay put.
  if (USE_MOCK_AUTH) {
    setMockSession(false);
    return true;
  }

  let logoutUrl = null;
  try {
    logoutUrl = await logout();
  } catch {
    /* fall back to the central login below */
  }
  const target = logoutUrl ?? CENTRAL_LOGIN_URL;
  window.location.href = `${target}?redirect_uri=${encodeURIComponent(SSO_CALLBACK_URL)}`;
  return true;
});

// ── Slice ───────────────────────────────────────────────────────────────────

const initialState = {
  // status drives every auth screen:
  //   'idle'        — nothing checked yet
  //   'loading'     — /api/auth/me in flight (show spinner)
  //   'authenticated' — valid session, user populated
  //   'unauthenticated' — no session → trigger the central login redirect
  //   'error'       — transient failure → show Retry
  status: "idle",
  user: null,
  error: null,
  // True when lib/api.js detects an endless login redirect loop. The UI then stops
  // reloading and shows an explanation instead of bouncing forever.
  ssoLoop: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // Fired from a window-event listener when services/api.js reports a redirect loop.
    ssoLoopDetected(state) {
      state.ssoLoop = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initSession.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(initSession.fulfilled, (state, action) => {
        state.status = "authenticated";
        state.user = action.payload;
        state.error = null;
      })
      .addCase(initSession.rejected, (state, action) => {
        const payload = action.payload;
        if (payload?.kind === "transient") {
          state.status = "error";
          state.error = payload.message;
        } else {
          // Clean "not signed in" (or an unexpected throw) → drive the login redirect.
          state.status = "unauthenticated";
          state.error = null;
        }
        state.user = null;
      })
      // Sign-in: same state transitions as a session check. In mock mode this is
      // the actual "login"; in real mode signIn redirects away and rejects.
      .addCase(signIn.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(signIn.fulfilled, (state, action) => {
        state.status = "authenticated";
        state.user = action.payload;
        state.error = null;
      })
      .addCase(signIn.rejected, (state) => {
        state.status = "unauthenticated";
        state.user = null;
      })
      // In mock mode signing out clears the session here (no central redirect).
      .addCase(signOut.fulfilled, (state) => {
        state.status = "unauthenticated";
        state.user = null;
      });
  },
});

export const { ssoLoopDetected } = authSlice.actions;

// ── Selectors ─────────────────────────────────────────────────────────────────
export const selectAuthStatus = (s) => s.auth.status;
export const selectCurrentUser = (s) => s.auth.user;
export const selectAuthError = (s) => s.auth.error;
export const selectSsoLoop = (s) => s.auth.ssoLoop;
export const selectIsAuthenticated = (s) => s.auth.status === "authenticated";

export default authSlice.reducer;
