// Privacy notices slice — includes the Art. 13/14 checklist state per audience.
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { noticeService } from '../../services/noticeService';
import { addFetchCases, addMutationCases } from './sliceHelpers';

const actor = (getState) => getState().auth.user;

export const fetchNotices = createAsyncThunk('notices/fetch', () => noticeService.list());
export const fetchChecklist = createAsyncThunk('notices/checklist', (audienceId) =>
  noticeService.checklist(audienceId).then((result) => ({ audienceId, result })));
export const generateNotice = createAsyncThunk('notices/generate', (payload, { getState, rejectWithValue }) =>
  noticeService.generate(actor(getState), payload).catch((e) => {
    if (e.code === 'CHECKLIST_INCOMPLETE') return rejectWithValue({ code: e.code, missing: e.missing });
    throw e;
  }));

const noticesSlice = createSlice({
  name: 'notices',
  initialState: {
    items: [],
    status: 'idle',
    saveStatus: 'idle',
    error: null,
    checklists: {},        // audienceId → { checklist, blocked, relevantCount }
    checklistStatus: 'idle',
  },
  reducers: {},
  extraReducers: (builder) => {
    addFetchCases(builder, fetchNotices);
    builder
      .addCase(fetchChecklist.pending, (state) => {
        state.checklistStatus = 'loading';
      })
      .addCase(fetchChecklist.fulfilled, (state, action) => {
        state.checklistStatus = 'succeeded';
        const { audienceId, result } = action.payload;
        state.checklists[audienceId] = {
          checklist: result.checklist,
          blocked: result.blocked,
          relevantCount: result.relevant.length,
        };
      })
      .addCase(fetchChecklist.rejected, (state, action) => {
        state.checklistStatus = 'failed';
        state.error = action.error?.message ?? 'Request failed';
      })
      // generateNotice handled by hand (not addMutationCases) because its
      // rejected case carries structured checklist details via rejectWithValue.
      .addCase(generateNotice.pending, (state) => {
        state.saveStatus = 'saving';
        state.error = null;
      })
      .addCase(generateNotice.fulfilled, (state, action) => {
        state.saveStatus = 'succeeded';
        if (action.payload?.id) state.items.unshift(action.payload);
      })
      .addCase(generateNotice.rejected, (state, action) => {
        state.saveStatus = 'failed';
        state.error = action.payload?.code ?? action.error?.message ?? 'Request failed';
      });
  },
});

export default noticesSlice.reducer;
