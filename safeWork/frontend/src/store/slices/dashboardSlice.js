import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

// SafeWork backend runs on 8082; RegulaOne (auth) runs on 8080
const SAFEWORK_API = "http://localhost:8082/api";

const getAuthHeaders = () => {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Fetches compliance dashboard data from the SafeWork backend.
// tenantId is passed as a query param — consistent with all other SafeWork endpoints
// that use getState().auth.user?.tenantId rather than relying on req.user.tenant
// (which may be null if the user record pre-dates tenant assignment).
export const fetchDashboard = createAsyncThunk(
  "dashboard/fetch",
  async (_, { getState, rejectWithValue }) => {
    try {
      const tenantId = getState().auth.user?.tenantId;
      if (!tenantId) return rejectWithValue("No tenantId in auth state");

      const response = await fetch(
        `${SAFEWORK_API}/dashboard/overview?tenantId=${tenantId}`,
        {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return rejectWithValue(err?.message || `Server error: ${response.status}`);
      }

      const json = await response.json();
      return json?.data ?? json;
    } catch (err) {
      return rejectWithValue(err.message || "Network error");
    }
  }
);

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState: {
    data: null,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboard.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDashboard.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchDashboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Unknown error";
      });
  },
});

export default dashboardSlice.reducer;
