/**
 * Consent slice — remembers whether the user has acknowledged the cookie notice.
 *
 * SafeVoice uses ONLY strictly necessary storage (a secure session cookie + a
 * language/theme preference), so under the ePrivacy Directive no opt-in consent
 * is legally required. We still show a one-time informational notice for
 * transparency, and remember that it was dismissed.
 */
import { createSlice } from "@reduxjs/toolkit";
import { STORAGE_KEYS } from "../config";

function initialAcknowledged() {
  try {
    return localStorage.getItem(STORAGE_KEYS.cookieConsent) === "true";
  } catch {
    return false;
  }
}

const consentSlice = createSlice({
  name: "consent",
  initialState: { cookieAcknowledged: initialAcknowledged() },
  reducers: {
    acknowledgeCookies(state) {
      state.cookieAcknowledged = true;
      try {
        localStorage.setItem(STORAGE_KEYS.cookieConsent, "true");
      } catch {
        /* ignore */
      }
    },
  },
});

export const { acknowledgeCookies } = consentSlice.actions;
export const selectCookieAcknowledged = (s) => s.consent.cookieAcknowledged;
export default consentSlice.reducer;
