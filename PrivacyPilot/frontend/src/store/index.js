// Redux store — one slice per feature, as mandated by the project rules
// (CLAUDE.md §26: Redux Toolkit, feature slices, services layer).
import { configureStore } from '@reduxjs/toolkit';

import ui from './slices/uiSlice';
import auth from './slices/authSlice';
import activities from './slices/activitiesSlice';
import dpias from './slices/dpiasSlice';
import vendors from './slices/vendorsSlice';
import transfers from './slices/transfersSlice';
import breaches from './slices/breachesSlice';
import dsars from './slices/dsarsSlice';
import notices from './slices/noticesSlice';
import audit from './slices/auditSlice';
import users from './slices/usersSlice';
import settings from './slices/settingsSlice';
import ai from './slices/aiSlice';

export const store = configureStore({
  reducer: {
    ui,
    auth,
    activities,
    dpias,
    vendors,
    transfers,
    breaches,
    dsars,
    notices,
    audit,
    users,
    settings,
    ai,
  },
});
