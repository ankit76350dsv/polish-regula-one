// DPIA slice — assessments linked to register activities.
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { dpiaService } from '../../services/dpiaService';
import { addFetchCases, addMutationCases } from './sliceHelpers';

const actor = (getState) => getState().auth.user;

export const fetchDpias = createAsyncThunk('dpias/fetch', () => dpiaService.list());
export const createDpiaForActivity = createAsyncThunk('dpias/createForActivity', (activityId, { getState }) =>
  dpiaService.createForActivity(actor(getState), activityId));
export const updateDpia = createAsyncThunk('dpias/update', ({ id, patch }, { getState }) =>
  dpiaService.update(actor(getState), id, patch));
export const signDpia = createAsyncThunk('dpias/sign', (id, { getState }) =>
  dpiaService.sign(actor(getState), id));

const dpiasSlice = createSlice({
  name: 'dpias',
  initialState: { items: [], status: 'idle', saveStatus: 'idle', error: null },
  reducers: {
    resetSaveStatus(state) { state.saveStatus = 'idle'; },
  },
  extraReducers: (builder) => {
    addFetchCases(builder, fetchDpias);
    addMutationCases(builder, createDpiaForActivity);
    addMutationCases(builder, updateDpia);
    addMutationCases(builder, signDpia);
  },
});

export const { resetSaveStatus } = dpiasSlice.actions;
export default dpiasSlice.reducer;
