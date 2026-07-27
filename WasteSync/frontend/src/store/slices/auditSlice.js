import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as auditApi from "../../api/auditApi";
import { getErrorMessage } from "../../api/axiosClient";

export const fetchAuditLogs = createAsyncThunk(
  "audit/fetch",
  async (filters, { rejectWithValue }) => {
    try {
      return await auditApi.fetchAuditLogs(filters);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to load audit logs"));
    }
  }
);

const auditSlice = createSlice({
  name: "audit",
  initialState: {
    logs: [],
    pagination: { total: 0, page: 1, limit: 20, totalPages: 1 },
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAuditLogs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAuditLogs.fulfilled, (state, action) => {
        state.loading = false;
        state.logs = action.payload?.logs ?? [];
        if (action.payload?.pagination) state.pagination = action.payload.pagination;
      })
      .addCase(fetchAuditLogs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default auditSlice.reducer;
