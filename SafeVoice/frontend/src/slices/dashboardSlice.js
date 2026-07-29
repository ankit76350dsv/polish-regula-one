/**
 * Dashboard slice — holds the headline stat-card numbers for the staff dashboard.
 * Loaded from the real backend through dashboardService, per the project's Redux rules.
 */
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import dashboardService from "../services/dashboardService";

export const fetchDashboardStats = createAsyncThunk("dashboard/fetchStats", () =>
  dashboardService.getStats(),
);

// The "cases needing attention" queue (unassigned, still-open cases).
export const fetchAttention = createAsyncThunk("dashboard/fetchAttention", (limit) =>
  dashboardService.getAttention(limit),
);

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState: {
    stats: null, // { openReports, unreadReplies, slaCompliancePercent, auditEntries }
    status: "idle",
    error: null,
    attention: [], // cases needing attention (unassigned)
    attentionStatus: "idle",
    attentionError: null,
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
      })
      .addCase(fetchAttention.pending, (s) => {
        s.attentionStatus = "loading";
        s.attentionError = null;
      })
      .addCase(fetchAttention.fulfilled, (s, a) => {
        s.attentionStatus = "succeeded";
        s.attention = a.payload;
      })
      .addCase(fetchAttention.rejected, (s, a) => {
        s.attentionStatus = "failed";
        s.attentionError = a.error?.message || "error";
      });
  },
});

export const selectDashboardStats = (s) => s.dashboard.stats;
export const selectDashboardStatus = (s) => s.dashboard.status;
export const selectAttention = (s) => s.dashboard.attention;
export const selectAttentionStatus = (s) => s.dashboard.attentionStatus;

export default dashboardSlice.reducer;
