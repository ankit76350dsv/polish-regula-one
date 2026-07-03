// AI assistant slice — loading/error state for the mock AI drafts.
// Components dispatch a thunk, await it, and apply the returned draft
// themselves (the human-in-the-loop step); the slice only tracks status.
import { createSlice, createAsyncThunk, isPending, isFulfilled, isRejected } from '@reduxjs/toolkit';
import { aiService } from '../../services/aiService';

const actor = (getState) => getState().auth.user;

export const aiDraftActivity = createAsyncThunk('ai/draftActivity', (text, { getState }) =>
  aiService.draftActivity(actor(getState), text));
export const aiDraftDpiaSection = createAsyncThunk('ai/draftDpiaSection', ({ dpia, activity, section }, { getState }) =>
  aiService.draftDpiaSection(actor(getState), dpia, activity, section));
export const aiSuggestRisks = createAsyncThunk('ai/suggestRisks', (dpia, { getState }) =>
  aiService.suggestRisks(actor(getState), dpia));
export const aiDraftBreachNotification = createAsyncThunk('ai/draftBreach', ({ breach, lang }, { getState }) =>
  aiService.draftBreachNotification(actor(getState), breach, lang));
export const aiDraftDsarReply = createAsyncThunk('ai/draftDsarReply', ({ dsar, lang }, { getState }) =>
  aiService.draftDsarReply(actor(getState), dsar, lang));

const isAiAction = (action) => action.type.startsWith('ai/');

const aiSlice = createSlice({
  name: 'ai',
  initialState: { status: 'idle', error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addMatcher((a) => isAiAction(a) && isPending(a), (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addMatcher((a) => isAiAction(a) && isFulfilled(a), (state) => {
        state.status = 'idle';
      })
      .addMatcher((a) => isAiAction(a) && isRejected(a), (state, action) => {
        state.status = 'failed';
        state.error = action.error?.message ?? 'AI request failed';
      });
  },
});

export default aiSlice.reducer;
