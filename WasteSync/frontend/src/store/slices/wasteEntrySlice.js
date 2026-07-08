import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as wasteEntryApi from "../../api/wasteEntryApi";
import { getErrorMessage } from "../../api/axiosClient";

export const fetchMonthlyEntries = createAsyncThunk(
  "wasteEntries/fetchMonthly",
  async ({ companyId, year }, { rejectWithValue }) => {
    try {
      return await wasteEntryApi.fetchMonthlyEntries({ companyId, year });
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to load waste entries"));
    }
  }
);

export const fetchEntryHistory = createAsyncThunk(
  "wasteEntries/fetchHistory",
  async ({ companyId, year, month }, { rejectWithValue }) => {
    try {
      return await wasteEntryApi.fetchEntryHistory({ companyId, year, month });
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to load history"));
    }
  }
);

export const recordMonthlyEntry = createAsyncThunk(
  "wasteEntries/record",
  async (data, { rejectWithValue }) => {
    try {
      return await wasteEntryApi.recordMonthlyEntry(data);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to save waste entry"));
    }
  }
);

const wasteEntrySlice = createSlice({
  name: "wasteEntries",
  initialState: {
    entries: [], // current (latest) figures per month
    loading: false,
    error: null,
    submitting: false,
    submitError: null,
    history: [], // version history for one month
    historyLoading: false,
  },
  reducers: {
    clearHistory: (state) => {
      state.history = [];
    },
    clearSubmitError: (state) => {
      state.submitError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMonthlyEntries.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMonthlyEntries.fulfilled, (state, action) => {
        state.loading = false;
        state.entries = action.payload?.entries ?? [];
      })
      .addCase(fetchMonthlyEntries.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(fetchEntryHistory.pending, (state) => {
        state.historyLoading = true;
      })
      .addCase(fetchEntryHistory.fulfilled, (state, action) => {
        state.historyLoading = false;
        state.history = action.payload?.history ?? [];
      })
      .addCase(fetchEntryHistory.rejected, (state) => {
        state.historyLoading = false;
      })

      .addCase(recordMonthlyEntry.pending, (state) => {
        state.submitting = true;
        state.submitError = null;
      })
      .addCase(recordMonthlyEntry.fulfilled, (state, action) => {
        state.submitting = false;
        const saved = action.payload;
        // Replace the current row for that month with the new latest version.
        const idx = state.entries.findIndex((e) => e.month === saved.month);
        if (idx !== -1) state.entries[idx] = saved;
        else state.entries.push(saved);
        state.entries.sort((a, b) => a.month - b.month);
      })
      .addCase(recordMonthlyEntry.rejected, (state, action) => {
        state.submitting = false;
        state.submitError = action.payload;
      });
  },
});

export const { clearHistory, clearSubmitError } = wasteEntrySlice.actions;
export default wasteEntrySlice.reducer;
