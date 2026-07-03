// ROPA activities slice — the register itself.
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { activityService } from '../../services/activityService';
import { addFetchCases, addMutationCases } from './sliceHelpers';

const actor = (getState) => getState().auth.user;

export const fetchActivities = createAsyncThunk('activities/fetch', () => activityService.list());
export const createActivity = createAsyncThunk('activities/create', (data, { getState }) =>
  activityService.create(actor(getState), data));
export const updateActivity = createAsyncThunk('activities/update', ({ id, patch }, { getState }) =>
  activityService.update(actor(getState), id, patch));
export const archiveActivity = createAsyncThunk('activities/archive', (id, { getState }) =>
  activityService.archive(actor(getState), id));
export const approveActivity = createAsyncThunk('activities/approve', (id, { getState }) =>
  activityService.approve(actor(getState), id));

const activitiesSlice = createSlice({
  name: 'activities',
  initialState: { items: [], status: 'idle', saveStatus: 'idle', error: null },
  reducers: {
    resetSaveStatus(state) { state.saveStatus = 'idle'; },
  },
  extraReducers: (builder) => {
    addFetchCases(builder, fetchActivities);
    addMutationCases(builder, createActivity);
    addMutationCases(builder, updateActivity);
    addMutationCases(builder, archiveActivity);
    addMutationCases(builder, approveActivity);
  },
});

export const { resetSaveStatus } = activitiesSlice.actions;
export default activitiesSlice.reducer;
