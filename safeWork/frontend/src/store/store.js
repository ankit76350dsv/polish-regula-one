import { configureStore } from "@reduxjs/toolkit";
import dashboardReducer  from "./slices/dashboardSlice";
import authReducer       from "./slices/authSlice";
import employeeReducer   from "./slices/employeeSlice";
import auditReducer      from "./slices/auditSlice";

// Central Redux store for the SafeWork frontend.
const store = configureStore({
  reducer: {
    dashboard: dashboardReducer,
    auth:      authReducer,
    employees: employeeReducer,
    // audit slice holds paginated audit logs for the Audit Report page.
    audit:     auditReducer,
  },
});

export default store;
