/**
 * Audit slice — read-only immutable activity log for the "Audit trail" page.
 */
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import auditService from "../services/auditService";

export const fetchAudit = createAsyncThunk("audit/fetch", () => auditService.list());

const auditSlice = createSlice({
  name: "audit",
  initialState: { list: [], status: "idle", error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAudit.pending, (s) => {
        s.status = "loading";
        s.error = null;
      })
      .addCase(fetchAudit.fulfilled, (s, a) => {
        s.status = "succeeded";
        s.list = a.payload;
      })
      .addCase(fetchAudit.rejected, (s, a) => {
        s.status = "failed";
        s.error = a.error?.message || "error";
      });
  },
});

export const selectAuditLogs = (s) => s.audit.list;
export const selectAuditStatus = (s) => s.audit.status;

export default auditSlice.reducer;
