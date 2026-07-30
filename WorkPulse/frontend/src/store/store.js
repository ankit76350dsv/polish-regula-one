import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import languageReducer from "./slices/languageSlice";

// Central Redux store for the WorkPulse frontend.
// Auth state is kept here; page data is fetched on demand via the API client.
const store = configureStore({
  reducer: {
    auth: authReducer,
    // language slice holds the chosen interface language (Polish or English).
    // It starts from the value saved in the browser, so the app opens in the
    // language the user chose last time — Polish on a first visit.
    language: languageReducer,
  },
});

export default store;
