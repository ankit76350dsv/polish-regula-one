import { configureStore } from '@reduxjs/toolkit';
import passwordRecoveryReducer from '../slices/passwordRecoverySlice';
import companyOverviewReducer from '../slices/companyOverviewSlice';
import myOverviewReducer from '../slices/myOverviewSlice';

// Redux Toolkit owns API lifecycle state for password recovery. The existing
// Zustand auth store remains the source of truth for the authenticated session.
//
// companyOverview holds the company-admin compliance dashboard: one server-built
// snapshot covering all six modules. It lives here so the loading, error and data
// states are managed in a slice rather than inside the screen component.
//
// myOverview holds the personal "My Workspace" dashboard — the same idea for a
// normal member of the company, built from that person's OWN records only. Kept as
// a separate slice because the two screens are loaded by different people and must
// never share one cache: an admin's company figures and an employee's own figures
// answer different questions.
export const reduxStore = configureStore({
  reducer: {
    passwordRecovery: passwordRecoveryReducer,
    companyOverview: companyOverviewReducer,
    myOverview: myOverviewReducer,
  },
});
