import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

// Fetches the full compliance dashboard data from the SafeWork backend.
// Backend is expected on port 5000; error message in the UI references this.
export const fetchDashboard = createAsyncThunk(
  "dashboard/fetch",
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch("http://localhost:5000/api/dashboard");
      if (!response.ok) {
        return rejectWithValue(`Server error: ${response.status}`);
      }
      return await response.json();
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
