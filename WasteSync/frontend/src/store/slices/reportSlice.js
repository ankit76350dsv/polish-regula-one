import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as reportApi from "../../api/reportApi";
import { getErrorMessage } from "../../api/axiosClient";

export const fetchReports = createAsyncThunk(
  "reports/fetchAll",
  async (filters, { rejectWithValue }) => {
    try {
      return await reportApi.fetchReports(filters);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to load reports"));
    }
  }
);

export const fetchReport = createAsyncThunk(
  "reports/fetchOne",
  async (id, { rejectWithValue }) => {
    try {
      return await reportApi.fetchReport(id);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to load report"));
    }
  }
);

export const generateReport = createAsyncThunk(
  "reports/generate",
  async ({ companyId, year }, { rejectWithValue }) => {
    try {
      return await reportApi.generateReport({ companyId, year });
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to generate report"));
    }
  }
);

export const submitReport = createAsyncThunk(
  "reports/submit",
  async (id, { rejectWithValue }) => {
    try {
      return await reportApi.submitReport(id);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to submit report"));
    }
  }
);

const reportSlice = createSlice({
  name: "reports",
  initialState: {
    list: [],
    selected: null,
    loading: false,
    error: null,
    generating: false,
    generateError: null,
  },
  reducers: {
    clearGenerateError: (state) => {
      state.generateError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchReports.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchReports.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload?.reports ?? [];
      })
      .addCase(fetchReports.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(fetchReport.fulfilled, (state, action) => {
        state.selected = action.payload;
      })

      .addCase(generateReport.pending, (state) => {
        state.generating = true;
        state.generateError = null;
      })
      .addCase(generateReport.fulfilled, (state, action) => {
        state.generating = false;
        // Put the freshly generated report at the top of the list.
        state.list.unshift(action.payload);
      })
      .addCase(generateReport.rejected, (state, action) => {
        state.generating = false;
        state.generateError = action.payload;
      })

      .addCase(submitReport.fulfilled, (state, action) => {
        const updated = action.payload;
        const idx = state.list.findIndex((r) => r._id === updated._id);
        if (idx !== -1) state.list[idx] = { ...state.list[idx], ...updated };
        if (state.selected && state.selected._id === updated._id) {
          state.selected = { ...state.selected, ...updated };
        }
      });
  },
});

export const { clearGenerateError } = reportSlice.actions;
export default reportSlice.reducer;
