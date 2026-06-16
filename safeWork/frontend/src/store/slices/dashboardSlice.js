import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

// SafeWork backend runs on 8082; RegulaOne (auth) runs on 8080
const SAFEWORK_API = "http://localhost:8082/api";

// We no longer read a token from localStorage or send an Authorization header.
// The auth token travels in an HttpOnly cookie, which the browser attaches
// automatically when we set `credentials: "include"` on the request below.

// Fetches compliance dashboard data from the SafeWork backend.
// We no longer send a tenantId — the backend reads it from the logged-in user's
// session (RegulaOne /api/auth/me) and only ever returns this tenant's data.
export const fetchDashboard = createAsyncThunk(
  "dashboard/fetch",
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch(
        `${SAFEWORK_API}/dashboard/overview`,
        {
          // Send the auth cookie with the request.
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
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
