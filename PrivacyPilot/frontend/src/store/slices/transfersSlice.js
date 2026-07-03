// Chapter V transfers slice.
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { transferService } from '../../services/transferService';
import { addFetchCases, addMutationCases } from './sliceHelpers';

const actor = (getState) => getState().auth.user;

export const fetchTransfers = createAsyncThunk('transfers/fetch', () => transferService.list());
export const createTransfer = createAsyncThunk('transfers/create', (data, { getState }) =>
  transferService.create(actor(getState), data));
export const updateTransfer = createAsyncThunk('transfers/update', ({ id, patch }, { getState }) =>
  transferService.update(actor(getState), id, patch));

const transfersSlice = createSlice({
  name: 'transfers',
  initialState: { items: [], status: 'idle', saveStatus: 'idle', error: null },
  reducers: {},
  extraReducers: (builder) => {
    addFetchCases(builder, fetchTransfers);
    addMutationCases(builder, createTransfer);
    addMutationCases(builder, updateTransfer);
  },
});

export default transfersSlice.reducer;
