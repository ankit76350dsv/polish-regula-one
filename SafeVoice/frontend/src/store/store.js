/**
 * The single Redux store for SafeVoice.
 *
 * Feature state lives in slices (see ../slices). For now the only slice is auth
 * (RegulaOne SSO). New features should add their reducer here rather than creating
 * a second store, so the whole app shares one predictable state tree.
 */
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../slices/authSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});
