import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import companyReducer from "./slices/companySlice";
import wasteEntryReducer from "./slices/wasteEntrySlice";
import reportReducer from "./slices/reportSlice";
import dashboardReducer from "./slices/dashboardSlice";
import auditReducer from "./slices/auditSlice";

// The single Redux store for the WasteSync frontend.
const store = configureStore({
  reducer: {
    auth: authReducer,
    companies: companyReducer,
    wasteEntries: wasteEntryReducer,
    reports: reportReducer,
    dashboard: dashboardReducer,
    audit: auditReducer,
  },
});

export default store;
