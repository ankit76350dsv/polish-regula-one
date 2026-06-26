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
import { clearSsoRedirectGuard, CENTRAL_LOGIN_URL, SSO_CALLBACK_URL } from "../services/api";
import { USE_MOCK } from "../config";
import mockApi from "../mock/mockApi";

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
    // MOCK MODE: there is no real SSO backend while we build the UI, so we return
    // a fixed staff user. Flip VITE_USE_MOCK=false to use the real RegulaOne SSO.
    if (USE_MOCK) {
      return mockApi.me();
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
);

/**
 * End the SSO session and leave for the central logout/login page.
 * We always navigate away afterwards, even if the backend call fails, so the user
 * is never left in a half-signed-out state.
 */
export const signOut = createAsyncThunk("auth/signOut", async () => {
  // MOCK MODE: there is no central app to bounce to, so we just clear the session
  // in state (the reducer below sets status → 'unauthenticated') and stay put.
  if (USE_MOCK) return true;

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
