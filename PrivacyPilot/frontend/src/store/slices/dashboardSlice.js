// Dashboard slice — a single read-only summary object (not a list). Every number is
// computed on the server; this slice just holds the fetched result.
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { dashboardService } from '../../services/dashboardService';

export const fetchDashboard = createAsyncThunk('dashboard/fetch', () => dashboardService.get());

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: { data: null, status: 'idle', error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboard.pending, (state) => { state.status = 'loading'; state.error = null; })
      .addCase(fetchDashboard.fulfilled, (state, action) => { state.status = 'succeeded'; state.data = action.payload; })
      .addCase(fetchDashboard.rejected, (state, action) => { state.status = 'failed'; state.error = action.error?.message; });
  },
});

export default dashboardSlice.reducer;
