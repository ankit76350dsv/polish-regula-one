/**
 * Audit slice — read-only immutable activity log for the "Audit trail" page.
 */
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import auditService from "../services/auditService";

export const fetchAudit = createAsyncThunk("audit/fetch", (params) => auditService.list(params));

const auditSlice = createSlice({
  name: "audit",
  initialState: {
    list: [],
    page: 1,
    size: 20,
    total: 0,
    totalPages: 0,
    status: "idle",
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAudit.pending, (s) => {
        s.status = "loading";
        s.error = null;
      })
      .addCase(fetchAudit.fulfilled, (s, a) => {
        s.status = "succeeded";
        s.list = a.payload.items;
        s.page = a.payload.page;
        s.size = a.payload.size;
        s.total = a.payload.total;
        s.totalPages = a.payload.totalPages;
      })
      .addCase(fetchAudit.rejected, (s, a) => {
        s.status = "failed";
        s.error = a.error?.message || "error";
      });
  },
});

export const selectAuditLogs = (s) => s.audit.list;
export const selectAuditStatus = (s) => s.audit.status;
export const selectAuditTotal = (s) => s.audit.total;
export const selectAuditTotalPages = (s) => s.audit.totalPages;

export default auditSlice.reducer;
