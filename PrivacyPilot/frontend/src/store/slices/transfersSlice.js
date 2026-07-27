// Chapter V transfers slice.
//
// Talks to the real backend through transferService. Identity/tenant come from the
// session cookie, so no "actor" is passed — the server derives it.
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { transferService } from '../../services/transferService';
import { addFetchCases, addMutationCases } from './sliceHelpers';

export const fetchTransfers = createAsyncThunk('transfers/fetch', () => transferService.list());
export const createTransfer = createAsyncThunk('transfers/create', (data) =>
  transferService.create(data));

// The backend PUT replaces the WHOLE transfer, but the UI edits one field at a time
// (e.g. the TIA toggle sends just { tiaDocumented }). Merge the patch onto the current
// record from the store and send the complete object, so unedited fields are not wiped.
export const updateTransfer = createAsyncThunk('transfers/update', ({ id, patch }, { getState }) => {
  const current = getState().transfers.items.find((t) => t.id === id) ?? {};
  return transferService.update(id, { ...current, ...patch });
});

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
