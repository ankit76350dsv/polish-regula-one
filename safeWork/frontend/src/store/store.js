import { configureStore } from "@reduxjs/toolkit";
import dashboardReducer from "./slices/dashboardSlice";
import authReducer from "./slices/authSlice";
import employeeReducer from "./slices/employeeSlice";

// Central Redux store for the SafeWork frontend.
const store = configureStore({
  reducer: {
    dashboard: dashboardReducer,
    // auth slice holds the authenticated user so any component can
    // access it via useSelector(state => state.auth.user)
    auth: authReducer,
    // employees slice holds the tenant's employee list fetched from /admin/users/:tenantId
    employees: employeeReducer,
  },
});

export default store;
