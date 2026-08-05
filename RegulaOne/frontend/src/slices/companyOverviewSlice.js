import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { dashboardService } from '../services/dashboardService';

// Turns whatever the API client threw into the plain shape the store keeps, so a
// component only ever reads { message, errorCode, httpStatus } and never has to
// know about Error objects. Same helper style as passwordRecoverySlice.
function toRejectedValue(error, fallbackMessage) {
  return {
    message: error?.message || fallbackMessage,
    errorCode: error?.errorCode || 'UNKNOWN_ERROR',
    httpStatus: error?.httpStatus,
  };
}

/**
 * Load the company's compliance overview.
 *
 * One request fetches every module's figures. The server is the only place that
 * counts records and works out legal deadlines, so nothing is recomputed here.
 */
export const fetchCompanyOverview = createAsyncThunk(
  'companyOverview/fetch',
  async (_arg, { rejectWithValue }) => {
    try {
      return await dashboardService.getCompanyOverview();
    } catch (error) {
      return rejectWithValue(
        toRejectedValue(error, 'Could not load the compliance overview.'),
      );
    }
  },
);

const initialState = {
  // 'idle' | 'loading' | 'succeeded' | 'failed'
  status: 'idle',
  // The whole CompanyOverviewResponse, exactly as the server sent it. It is kept
  // unmodified on purpose: the screen renders server-computed facts, and reshaping
  // them here would be the first step towards the browser inventing numbers again.
  data: null,
  error: null,
  // When the last successful load finished, so the screen can show "updated at".
  loadedAt: null,
};

const companyOverviewSlice = createSlice({
  name: 'companyOverview',
  initialState,
  reducers: {
    // Called on sign-out / company switch so one company's figures can never be
    // left on screen for the next session.
    clearCompanyOverview: () => ({ ...initialState }),
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCompanyOverview.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchCompanyOverview.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload ?? null;
        state.error = null;
        state.loadedAt = new Date().toISOString();
      })
      .addCase(fetchCompanyOverview.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? { message: 'Could not load the compliance overview.' };
        // The previous snapshot is deliberately KEPT. A failed refresh should not
        // wipe the figures an admin is looking at; the screen shows a stale-data
        // warning alongside them instead.
      });
  },
});

export const { clearCompanyOverview } = companyOverviewSlice.actions;

// ── Selectors ────────────────────────────────────────────────────────────────
// Components read through these so the state shape stays an internal detail.

export const selectCompanyOverview = (state) => state.companyOverview.data;
export const selectCompanyOverviewStatus = (state) => state.companyOverview.status;
export const selectCompanyOverviewError = (state) => state.companyOverview.error;
export const selectCompanyOverviewLoadedAt = (state) => state.companyOverview.loadedAt;

/** True only for the very first load, when there is nothing to show yet. */
export const selectCompanyOverviewIsInitialLoad = (state) =>
  state.companyOverview.status === 'loading' && state.companyOverview.data === null;

export default companyOverviewSlice.reducer;
