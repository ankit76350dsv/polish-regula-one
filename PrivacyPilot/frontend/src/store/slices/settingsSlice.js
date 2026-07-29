// Settings slice — company + DPO (with the UODO 14-day notification tracker).
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { settingsService } from '../../services/settingsService';

const actor = (getState) => getState().auth.user;

export const fetchSettings = createAsyncThunk('settings/fetch', () => settingsService.get());
export const updateSettings = createAsyncThunk('settings/update', (patch, { getState }) =>
  settingsService.update(actor(getState), patch));

const settingsSlice = createSlice({
  name: 'settings',
  initialState: { data: null, status: 'idle', saveStatus: 'idle', error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.pending, (state) => { state.status = 'loading'; state.error = null; })
      .addCase(fetchSettings.fulfilled, (state, action) => { state.status = 'succeeded'; state.data = action.payload; })
      .addCase(fetchSettings.rejected, (state, action) => { state.status = 'failed'; state.error = action.error?.message; })
      .addCase(updateSettings.pending, (state) => { state.saveStatus = 'saving'; state.error = null; })
      .addCase(updateSettings.fulfilled, (state, action) => { state.saveStatus = 'succeeded'; state.data = action.payload; })
      .addCase(updateSettings.rejected, (state, action) => { state.saveStatus = 'failed'; state.error = action.error?.message; });
  },
});

export default settingsSlice.reducer;
