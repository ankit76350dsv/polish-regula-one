// DSAR slice (Arts. 15–22 with the Art. 12(3) deadline engine).
//
// Every thunk uses the real backend through dsarService. Identity and tenant are
// derived from the secure session cookie by the server, so no frontend "actor" is
// sent and authorization/auditing cannot be spoofed by the browser.
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { dsarService } from '../../services/dsarService';
import { addFetchCases, addMutationCases } from './sliceHelpers';

export const fetchDsars = createAsyncThunk('dsars/fetch', () => dsarService.list());
export const createDsar = createAsyncThunk('dsars/create', (data) =>
  dsarService.create(data));

// The backend PUT accepts the whole editable DsarRequest while the detail page sends
// small patches (identity or task changes). Merge each patch with the current Redux
// record first so an update cannot erase fields the user did not touch.
export const updateDsar = createAsyncThunk('dsars/update', ({ id, patch }, { getState }) => {
  const current = getState().dsars.items.find((dsar) => dsar.id === id) ?? {};
  return dsarService.update(id, { ...current, ...patch });
});

export const extendDsar = createAsyncThunk('dsars/extend', ({ id, reason }) =>
  dsarService.extend(id, reason));
export const completeDsar = createAsyncThunk('dsars/complete', (id) =>
  dsarService.complete(id));
export const refuseDsar = createAsyncThunk('dsars/refuse', ({ id, reason }) =>
  dsarService.refuse(id, reason));

const dsarsSlice = createSlice({
  name: 'dsars',
  initialState: { items: [], status: 'idle', saveStatus: 'idle', error: null },
  reducers: {},
  extraReducers: (builder) => {
    addFetchCases(builder, fetchDsars);
    addMutationCases(builder, createDsar);
    addMutationCases(builder, updateDsar);
    addMutationCases(builder, extendDsar);
    addMutationCases(builder, completeDsar);
    addMutationCases(builder, refuseDsar);
  },
});

export default dsarsSlice.reducer;
