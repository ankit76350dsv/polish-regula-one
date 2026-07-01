/**
 * The single Redux store for SafeVoice.
 *
 * Each feature owns a slice (see ../slices). Shared and API-backed state flows
 * through here so the whole app has one predictable, debuggable state tree, per
 * the project's mandatory Redux Toolkit rules. Adding a feature = add its reducer.
 */
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../slices/authSlice";
import reportsReducer from "../slices/reportsSlice";
import messagesReducer from "../slices/messagesSlice";
import usersReducer from "../slices/usersSlice";
import auditReducer from "../slices/auditSlice";
import settingsReducer from "../slices/settingsSlice";
import uiReducer from "../slices/uiSlice";
import consentReducer from "../slices/consentSlice";
import dashboardReducer from "../slices/dashboardSlice";
import orgReducer from "../slices/orgSlice";
import { setCurrentActor } from "../services/identity";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    reports: reportsReducer,
    messages: messagesReducer,
    users: usersReducer,
    audit: auditReducer,
    settings: settingsReducer,
    ui: uiReducer,
    consent: consentReducer,
    dashboard: dashboardReducer,
    org: orgReducer,
  },
});

// Keep the signed-in user's tenantId in sync for the plain-JS service layer. Whenever
// the auth user changes, copy their tenantId into the identity holder so userService can
// read it for the RegulaOne invite payload (staff SafeVoice calls send no identity — the
// backend derives it from the session cookie). We only write when the user reference
// actually changes, so this stays cheap.
let lastUser;
store.subscribe(() => {
  const user = store.getState().auth.user;
  if (user !== lastUser) {
    lastUser = user;
    setCurrentActor(user);
  }
});
