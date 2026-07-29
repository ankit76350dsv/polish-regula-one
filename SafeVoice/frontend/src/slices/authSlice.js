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

// How long we wait for /api/auth/me before treating the backend as unreachable.
// Without this, a dead/wrong-host backend leaves the app stuck on the spinner forever.
const ME_TIMEOUT_MS = 8000;

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
 * Sign in. There is no in-app login form — hand off to the central RegulaOne login
 * page (the browser leaves), exactly like the SSO redirect everywhere else.
 */
export const signIn = createAsyncThunk(
  "auth/signIn",
  async (_arg, { rejectWithValue }) => {
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
    // Lets the user deliberately clear the guard from the stable login screen.
    ssoLoopCleared(state) {
      state.ssoLoop = false;
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
      // Sign-in: same state transitions as a session check. signIn redirects the
      // browser to the central login and rejects, so we stay "unauthenticated" here.
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
      // Sign-out clears the user; the thunk also navigates to the central logout page.
      .addCase(signOut.fulfilled, (state) => {
        state.status = "unauthenticated";
        state.user = null;
      });
  },
});

export const { ssoLoopDetected, ssoLoopCleared } = authSlice.actions;

// ── Selectors ─────────────────────────────────────────────────────────────────
export const selectAuthStatus = (s) => s.auth.status;
export const selectCurrentUser = (s) => s.auth.user;
export const selectAuthError = (s) => s.auth.error;
export const selectSsoLoop = (s) => s.auth.ssoLoop;
export const selectIsAuthenticated = (s) => s.auth.status === "authenticated";

export default authSlice.reducer;
