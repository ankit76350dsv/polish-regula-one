// Breach register slice (Arts. 33–34).
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { breachService } from '../../services/breachService';
import { addFetchCases, addMutationCases } from './sliceHelpers';

const actor = (getState) => getState().auth.user;

export const fetchBreaches = createAsyncThunk('breaches/fetch', () => breachService.list());
export const createBreach = createAsyncThunk('breaches/create', (data, { getState }) =>
  breachService.create(actor(getState), data));
export const updateBreach = createAsyncThunk('breaches/update', ({ id, patch }, { getState }) =>
  breachService.update(actor(getState), id, patch));
export const markBreachNotified = createAsyncThunk('breaches/markNotified', (id, { getState }) =>
  breachService.markNotified(actor(getState), id));

const breachesSlice = createSlice({
  name: 'breaches',
  initialState: { items: [], status: 'idle', saveStatus: 'idle', error: null },
  reducers: {},
  extraReducers: (builder) => {
    addFetchCases(builder, fetchBreaches);
    addMutationCases(builder, createBreach);
    addMutationCases(builder, updateBreach);
    addMutationCases(builder, markBreachNotified);
  },
});

export default breachesSlice.reducer;
