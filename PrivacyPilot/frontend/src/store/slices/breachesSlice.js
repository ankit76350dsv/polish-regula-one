// Breach register slice (Arts. 33–34).
//
// Talks to the real backend through breachService. Identity/tenant come from the
// session cookie, so no "actor" is passed — the server derives it.
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { breachService } from '../../services/breachService';
import { addFetchCases, addMutationCases } from './sliceHelpers';

export const fetchBreaches = createAsyncThunk('breaches/fetch', () => breachService.list());
export const createBreach = createAsyncThunk('breaches/create', (data) =>
  breachService.create(data));

// The backend PUT replaces the WHOLE breach, but the UI edits a few fields at a time
// (e.g. { remediation, status } or { uodoReference }). Merge the patch onto the current
// record from the store and send the complete object, so unedited fields are not wiped.
export const updateBreach = createAsyncThunk('breaches/update', ({ id, patch }, { getState }) => {
  const current = getState().breaches.items.find((b) => b.id === id) ?? {};
  return breachService.update(id, { ...current, ...patch });
});

export const markBreachNotified = createAsyncThunk('breaches/markNotified', (id) =>
  breachService.markNotified(id));
export const markBreachSubjectsNotified = createAsyncThunk('breaches/markSubjectsNotified', (id) =>
  breachService.markSubjectsNotified(id));

const breachesSlice = createSlice({
  name: 'breaches',
  initialState: { items: [], status: 'idle', saveStatus: 'idle', error: null },
  reducers: {},
  extraReducers: (builder) => {
    addFetchCases(builder, fetchBreaches);
    addMutationCases(builder, createBreach);
    addMutationCases(builder, updateBreach);
    addMutationCases(builder, markBreachNotified);
    addMutationCases(builder, markBreachSubjectsNotified);
  },
});

export default breachesSlice.reducer;
