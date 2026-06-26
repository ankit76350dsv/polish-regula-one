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
  },
});
