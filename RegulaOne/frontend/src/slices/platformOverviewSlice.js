import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { dashboardService } from '../services/dashboardService';

// Turns whatever the API client threw into the plain shape the store keeps, so a
// component only ever reads { message, errorCode, httpStatus } and never has to
// know about Error objects. Same helper style as the other two dashboard slices.
function toRejectedValue(error, fallbackMessage) {
  return {
    message: error?.message || fallbackMessage,
    errorCode: error?.errorCode || 'UNKNOWN_ERROR',
    httpStatus: error?.httpStatus,
  };
}

/**
 * Load the platform operator's business overview.
 *
 * One request covers the whole customer base. The server counts the customers, groups
 * every amount by its currency and works out the plan dates, so nothing is recomputed
 * here — the browser only formats.
 *
 * This is the third of the three dashboard slices, and the widest in scope:
 *   platformOverview → "how is the business doing?"  (all customers, commercial only)
 *   companyOverview  → "is my company compliant?"    (one company)
 *   myOverview       → "am I in order?"              (one person)
 *
 * WHY THIS SLICE EXISTS AT ALL: the screen used to call the API through
 * @tanstack/react-query, which put the response outside Redux. The project standard
 * is Redux Toolkit for every API integration, and the other two dashboards already
 * follow it — so this brings the last one into line and gives the screen a real error
 * state, which react-query's ignored `error` never did.
 */
export const fetchPlatformOverview = createAsyncThunk(
  'platformOverview/fetch',
  async (_arg, { rejectWithValue }) => {
    try {
      return await dashboardService.getPlatformOverview();
    } catch (error) {
      return rejectWithValue(toRejectedValue(error, 'Could not load the platform overview.'));
    }
  },
);

const initialState = {
  // 'idle' | 'loading' | 'succeeded' | 'failed'
  status: 'idle',
  // The whole PlatformOverviewResponse, exactly as the server sent it. Kept
  // unmodified on purpose: the screen renders server-computed facts, and reshaping
  // them here would be the first step towards the browser inventing numbers.
  data: null,
  error: null,
  // When the last successful load finished, so the screen can show "updated at".
  loadedAt: null,
};

const platformOverviewSlice = createSlice({
  name: 'platformOverview',
  initialState,
  reducers: {
    // Called on sign-out. This snapshot names customer companies and what they pay,
    // so it must not be left in memory for whoever signs in next.
    clearPlatformOverview: () => ({ ...initialState }),
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPlatformOverview.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchPlatformOverview.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload ?? null;
        state.error = null;
        state.loadedAt = new Date().toISOString();
      })
      .addCase(fetchPlatformOverview.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? { message: 'Could not load the platform overview.' };
        // The previous snapshot is deliberately KEPT. A failed refresh should not wipe
        // the figures on screen; a stale-data warning is shown alongside them instead.
      });
  },
});

export const { clearPlatformOverview } = platformOverviewSlice.actions;

// ── Selectors ────────────────────────────────────────────────────────────────
// Components read through these so the state shape stays an internal detail.

export const selectPlatformOverview = (state) => state.platformOverview.data;
export const selectPlatformOverviewStatus = (state) => state.platformOverview.status;
export const selectPlatformOverviewError = (state) => state.platformOverview.error;
export const selectPlatformOverviewLoadedAt = (state) => state.platformOverview.loadedAt;

/** True only for the very first load, when there is nothing to show yet. */
export const selectPlatformOverviewIsInitialLoad = (state) =>
  state.platformOverview.status === 'loading' && state.platformOverview.data === null;

export default platformOverviewSlice.reducer;
