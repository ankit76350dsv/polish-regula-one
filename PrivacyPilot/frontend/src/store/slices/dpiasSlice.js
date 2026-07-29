// DPIA slice — assessments linked to register activities.
//
// Each thunk calls the real backend through dpiaService (which hits
// /api/privacypilot/dpias). Identity/tenant come from the session cookie the
// browser sends, so the thunks no longer pass an "actor" — the server derives it.
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { dpiaService } from '../../services/dpiaService';
import { addFetchCases, addMutationCases } from './sliceHelpers';

export const fetchDpias = createAsyncThunk('dpias/fetch', () => dpiaService.list());
export const createDpiaForActivity = createAsyncThunk('dpias/createForActivity', (activityId) =>
  dpiaService.create(activityId));

// The backend PUT replaces the WHOLE DPIA content, but the UI saves one small field
// at a time (e.g. just { description }). So we merge the patch onto the current
// record from the store and send the complete object — otherwise unedited fields
// (risks, measures, …) would be wiped.
export const updateDpia = createAsyncThunk('dpias/update', ({ id, patch }, { getState }) => {
  const current = getState().dpias.items.find((d) => d.id === id) ?? {};
  return dpiaService.update(id, { ...current, ...patch });
});

export const signDpia = createAsyncThunk('dpias/sign', (id) => dpiaService.sign(id));

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
