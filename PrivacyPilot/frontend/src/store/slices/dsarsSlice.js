// DSAR slice (Arts. 15–22 with the Art. 12(3) deadline engine).
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { dsarService } from '../../services/dsarService';
import { addFetchCases, addMutationCases } from './sliceHelpers';

const actor = (getState) => getState().auth.user;

export const fetchDsars = createAsyncThunk('dsars/fetch', () => dsarService.list());
export const createDsar = createAsyncThunk('dsars/create', (data, { getState }) =>
  dsarService.create(actor(getState), data));
export const updateDsar = createAsyncThunk('dsars/update', ({ id, patch }, { getState }) =>
  dsarService.update(actor(getState), id, patch));
export const extendDsar = createAsyncThunk('dsars/extend', ({ id, reason }, { getState }) =>
  dsarService.extend(actor(getState), id, reason));
export const completeDsar = createAsyncThunk('dsars/complete', (id, { getState }) =>
  dsarService.complete(actor(getState), id));

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
  },
});

export default dsarsSlice.reducer;
