/**
 * Dashboard slice — holds the headline stat-card numbers for the staff dashboard.
 * Loaded from the real backend through dashboardService, per the project's Redux rules.
 */
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import dashboardService from "../services/dashboardService";

export const fetchDashboardStats = createAsyncThunk("dashboard/fetchStats", () =>
  dashboardService.getStats(),
);

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState: {
    stats: null, // { openReports, unreadReplies, slaCompliancePercent, auditEntries }
    status: "idle",
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboardStats.pending, (s) => {
        s.status = "loading";
        s.error = null;
      })
      .addCase(fetchDashboardStats.fulfilled, (s, a) => {
        s.status = "succeeded";
        s.stats = a.payload;
      })
      .addCase(fetchDashboardStats.rejected, (s, a) => {
        s.status = "failed";
        s.error = a.error?.message || "error";
      });
  },
});

export const selectDashboardStats = (s) => s.dashboard.stats;
export const selectDashboardStatus = (s) => s.dashboard.status;

export default dashboardSlice.reducer;
