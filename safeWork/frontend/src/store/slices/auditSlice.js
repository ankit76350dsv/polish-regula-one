import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

const API_BASE_URL = "http://localhost:8082/api";

const authHeaders = () => {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Fetches a paginated, filtered audit log for the current tenant.
//
// filters: { action?, userId?, resource?, search?, startDate?, endDate?, page?, limit? }
export const fetchAuditLogs = createAsyncThunk(
  "audit/fetchLogs",
  async (filters = {}, { getState, rejectWithValue }) => {
    try {
      const tenantId = getState().auth.user?.tenantId;
      if (!tenantId) return rejectWithValue("No tenantId found in auth state");

      const params = new URLSearchParams();
      params.set("tenantId", tenantId);
      if (filters.action)    params.set("action",    filters.action);
      if (filters.userId)    params.set("userId",    filters.userId);
      if (filters.resource)  params.set("resource",  filters.resource);
      if (filters.search)    params.set("search",    filters.search);
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate)   params.set("endDate",   filters.endDate);
      if (filters.page)      params.set("page",      String(filters.page));
      if (filters.limit)     params.set("limit",     String(filters.limit));

      const qs  = params.toString();
      const url = `${API_BASE_URL}/admin/audit-logs${qs ? `?${qs}` : ""}`;

      const response = await axios.get(url, {
        withCredentials: true,
        headers: authHeaders(),
      });

      // Backend wraps in { success, message, data: { count, logs, pagination } }
      return response.data?.data ?? response.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch audit logs");
    }
  }
);

const auditSlice = createSlice({
  name: "audit",
  initialState: {
    logs:       [],
    pagination: { total: 0, page: 1, limit: 20, totalPages: 1 },
    loading:    false,
    error:      null,
  },
  reducers: {
    clearAuditLogs: (state) => {
      state.logs       = [];
      state.pagination = { total: 0, page: 1, limit: 20, totalPages: 1 };
      state.error      = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAuditLogs.pending, (state) => {
        state.loading = true;
        state.error   = null;
      })
      .addCase(fetchAuditLogs.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload?.logs) {
          state.logs       = action.payload.logs;
          if (action.payload.pagination) {
            state.pagination = action.payload.pagination;
          }
        } else {
          state.logs = Array.isArray(action.payload) ? action.payload : [];
        }
      })
      .addCase(fetchAuditLogs.rejected, (state, action) => {
        state.loading = false;
        state.error   = action.payload;
      });
  },
});

export const { clearAuditLogs } = auditSlice.actions;
export default auditSlice.reducer;
