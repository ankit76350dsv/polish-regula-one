import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import companyReducer from "./slices/companySlice";
import wasteEntryReducer from "./slices/wasteEntrySlice";
import reportReducer from "./slices/reportSlice";
import dashboardReducer from "./slices/dashboardSlice";
import auditReducer from "./slices/auditSlice";
import languageReducer from "./slices/languageSlice";

// The single Redux store for the WasteSync frontend.
const store = configureStore({
  reducer: {
    auth: authReducer,
    companies: companyReducer,
    wasteEntries: wasteEntryReducer,
    reports: reportReducer,
    dashboard: dashboardReducer,
    audit: auditReducer,
    // language slice holds the chosen interface language (Polish or English).
    // It lives in the store, not in a component, so every screen switches at the
    // same moment and none can disagree about which language is showing.
    language: languageReducer,
  },
});

export default store;
