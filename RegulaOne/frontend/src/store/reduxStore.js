import { configureStore } from '@reduxjs/toolkit';
import passwordRecoveryReducer from '../slices/passwordRecoverySlice';
import companyOverviewReducer from '../slices/companyOverviewSlice';

// Redux Toolkit owns API lifecycle state for password recovery. The existing
// Zustand auth store remains the source of truth for the authenticated session.
//
// companyOverview holds the company-admin compliance dashboard: one server-built
// snapshot covering all six modules. It lives here so the loading, error and data
// states are managed in a slice rather than inside the screen component.
export const reduxStore = configureStore({
  reducer: {
    passwordRecovery: passwordRecoveryReducer,
    companyOverview: companyOverviewReducer,
  },
});
