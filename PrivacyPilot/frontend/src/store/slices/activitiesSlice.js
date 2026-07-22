// ROPA activities slice — the register itself.
//
// Each thunk calls the real backend through activityService (which hits
// /api/privacypilot/activities). Identity/tenant come from the session cookie the
// browser sends, so the thunks no longer pass an "actor" — the server derives it.
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { activityService } from '../../services/activityService';
import { addFetchCases, addMutationCases } from './sliceHelpers';

export const fetchActivities = createAsyncThunk('activities/fetch', () => activityService.list());
export const createActivity = createAsyncThunk('activities/create', (data) =>
  activityService.create(data));
export const updateActivity = createAsyncThunk('activities/update', ({ id, patch }) =>
  activityService.update(id, patch));
export const archiveActivity = createAsyncThunk('activities/archive', (id) =>
  activityService.archive(id));
export const approveActivity = createAsyncThunk('activities/approve', (id) =>
  activityService.approve(id));

const activitiesSlice = createSlice({
  name: 'activities',
  initialState: { items: [], status: 'idle', saveStatus: 'idle', error: null },
  reducers: {
    resetSaveStatus(state) { state.saveStatus = 'idle'; },
  },
  extraReducers: (builder) => {
    addFetchCases(builder, fetchActivities);
    // Create / update / approve all return the full activity → upsert it into the list.
    addMutationCases(builder, createActivity);
    addMutationCases(builder, updateActivity);
    addMutationCases(builder, approveActivity);
    // Archive returns just the id and has no "after" state — remove it from the list
    // so it disappears from the register immediately (it is kept on the server).
    builder
      .addCase(archiveActivity.pending, (state) => {
        state.saveStatus = 'saving';
        state.error = null;
      })
      .addCase(archiveActivity.fulfilled, (state, action) => {
        state.saveStatus = 'succeeded';
        state.items = state.items.filter((a) => a.id !== action.payload);
      })
      .addCase(archiveActivity.rejected, (state, action) => {
        state.saveStatus = 'failed';
        state.error = action.error?.message ?? 'Request failed';
      });
  },
});

export const { resetSaveStatus } = activitiesSlice.actions;
export default activitiesSlice.reducer;
