import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as dashboardApi from "../../api/dashboardApi";
import { getErrorMessage } from "../../api/axiosClient";

export const fetchDashboard = createAsyncThunk(
  "dashboard/fetch",
  async (filters, { rejectWithValue }) => {
    try {
      return await dashboardApi.fetchDashboardOverview(filters);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to load dashboard"));
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
        state.error = action.payload;
      });
  },
});

export default dashboardSlice.reducer;
