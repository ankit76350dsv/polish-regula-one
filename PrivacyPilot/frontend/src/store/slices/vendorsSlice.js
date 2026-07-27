// Processors (Art. 28) slice.
//
// Talks to the real backend through vendorService. Identity/tenant come from the
// session cookie, so no "actor" is passed — the server derives it.
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { vendorService } from '../../services/vendorService';
import { addFetchCases, addMutationCases } from './sliceHelpers';

export const fetchVendors = createAsyncThunk('vendors/fetch', () => vendorService.list());
export const createVendor = createAsyncThunk('vendors/create', (data) =>
  vendorService.create(data));

// The backend PUT replaces the WHOLE vendor, but the UI edits one field at a time
// (e.g. just { dpaStatus }). Merge the patch onto the current record from the store
// and send the complete object, so unedited fields are not wiped.
export const updateVendor = createAsyncThunk('vendors/update', ({ id, patch }, { getState }) => {
  const current = getState().vendors.items.find((v) => v.id === id) ?? {};
  return vendorService.update(id, { ...current, ...patch });
});

// Archive (soft-delete). The backend refuses with 409 (CONFLICT) if an activity or
// transfer still links to the vendor; the page turns that into a clear message.
export const archiveVendor = createAsyncThunk('vendors/archive', (id) => vendorService.archive(id));

const vendorsSlice = createSlice({
  name: 'vendors',
  initialState: { items: [], status: 'idle', saveStatus: 'idle', error: null },
  reducers: {},
  extraReducers: (builder) => {
    addFetchCases(builder, fetchVendors);
    addMutationCases(builder, createVendor);
    addMutationCases(builder, updateVendor);
    // Archive returns just the id and has no "after" state — remove it from the list
    // on success so it disappears immediately (it is kept on the server).
    builder
      .addCase(archiveVendor.pending, (state) => {
        state.saveStatus = 'saving';
        state.error = null;
      })
      .addCase(archiveVendor.fulfilled, (state, action) => {
        state.saveStatus = 'succeeded';
        state.items = state.items.filter((v) => v.id !== action.payload);
      })
      .addCase(archiveVendor.rejected, (state, action) => {
        state.saveStatus = 'failed';
        state.error = action.error?.message ?? 'Request failed';
      });
  },
});

export default vendorsSlice.reducer;
