import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";

// Central Redux store for the WorkPulse frontend.
// Auth state is kept here; page data is fetched on demand via the API client.
const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});

export default store;
