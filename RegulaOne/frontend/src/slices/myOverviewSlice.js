import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { dashboardService } from '../services/dashboardService';

// Turns whatever the API client threw into the plain shape the store keeps, so a
// component only ever reads { message, errorCode, httpStatus } and never has to
// know about Error objects. Same helper style as companyOverviewSlice.
function toRejectedValue(error, fallbackMessage) {
  return {
    message: error?.message || fallbackMessage,
    errorCode: error?.errorCode || 'UNKNOWN_ERROR',
    httpStatus: error?.httpStatus,
  };
}

/**
 * Load the signed-in person's own workspace.
 *
 * One request fetches every module's figures FOR THAT PERSON. The server is the
 * only place that counts records and works out deadlines — document expiry, the
 * yearly overtime cap, the whistleblower clocks — so nothing is recomputed here.
 *
 * This is the personal twin of companyOverviewSlice: same shape, different
 * question. That one asks "is my company compliant?", this one asks "am I?".
 */
export const fetchMyOverview = createAsyncThunk(
  'myOverview/fetch',
  async (_arg, { rejectWithValue }) => {
    try {
      return await dashboardService.getMyOverview();
    } catch (error) {
      return rejectWithValue(toRejectedValue(error, 'Could not load your workspace.'));
    }
  },
);

const initialState = {
  // 'idle' | 'loading' | 'succeeded' | 'failed'
  status: 'idle',
  // The whole MyOverviewResponse, exactly as the server sent it. It is kept
  // unmodified on purpose: the screen renders server-computed facts, and reshaping
  // them here would be the first step towards the browser inventing numbers.
  data: null,
  error: null,
  // When the last successful load finished, so the screen can show "updated at".
  loadedAt: null,
};

const myOverviewSlice = createSlice({
  name: 'myOverview',
  initialState,
  reducers: {
    // Called on sign-out so one person's own figures — including their document
    // expiry dates — can never be left on screen for whoever signs in next.
    clearMyOverview: () => ({ ...initialState }),
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyOverview.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchMyOverview.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload ?? null;
        state.error = null;
        state.loadedAt = new Date().toISOString();
      })
      .addCase(fetchMyOverview.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? { message: 'Could not load your workspace.' };
        // The previous snapshot is deliberately KEPT. A failed refresh should not
        // wipe the figures the person is looking at; the screen shows a stale-data
        // warning alongside them instead.
      });
  },
});

export const { clearMyOverview } = myOverviewSlice.actions;

// ── Selectors ────────────────────────────────────────────────────────────────
// Components read through these so the state shape stays an internal detail.

export const selectMyOverview = (state) => state.myOverview.data;
export const selectMyOverviewStatus = (state) => state.myOverview.status;
export const selectMyOverviewError = (state) => state.myOverview.error;
export const selectMyOverviewLoadedAt = (state) => state.myOverview.loadedAt;

/** True only for the very first load, when there is nothing to show yet. */
export const selectMyOverviewIsInitialLoad = (state) =>
  state.myOverview.status === 'loading' && state.myOverview.data === null;

export default myOverviewSlice.reducer;
