import { configureStore } from '@reduxjs/toolkit';
import passwordRecoveryReducer from '../slices/passwordRecoverySlice';

// Redux Toolkit owns API lifecycle state for password recovery. The existing
// Zustand auth store remains the source of truth for the authenticated session.
export const reduxStore = configureStore({
  reducer: {
    passwordRecovery: passwordRecoveryReducer,
  },
});
