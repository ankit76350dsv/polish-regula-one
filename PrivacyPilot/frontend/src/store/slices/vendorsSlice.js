// Processors (Art. 28) slice.
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { vendorService } from '../../services/vendorService';
import { addFetchCases, addMutationCases } from './sliceHelpers';

const actor = (getState) => getState().auth.user;

export const fetchVendors = createAsyncThunk('vendors/fetch', () => vendorService.list());
export const createVendor = createAsyncThunk('vendors/create', (data, { getState }) =>
  vendorService.create(actor(getState), data));
export const updateVendor = createAsyncThunk('vendors/update', ({ id, patch }, { getState }) =>
  vendorService.update(actor(getState), id, patch));

const vendorsSlice = createSlice({
  name: 'vendors',
  initialState: { items: [], status: 'idle', saveStatus: 'idle', error: null },
  reducers: {},
  extraReducers: (builder) => {
    addFetchCases(builder, fetchVendors);
    addMutationCases(builder, createVendor);
    addMutationCases(builder, updateVendor);
  },
});

export default vendorsSlice.reducer;
