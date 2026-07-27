// Privacy notices slice — includes the Art. 13/14 checklist state per audience.
//
// Talks to the real backend through noticeService. Identity/tenant come from the
// session cookie, so no "actor" is passed. The NOTICE TEXT is still compiled on the
// client (buildNoticeContent) and sent to the server — see noticeService.js for why.
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { noticeService } from '../../services/noticeService';
import { buildNoticeContent } from '../../lib/noticeBuilder';
import { addFetchCases } from './sliceHelpers';

export const fetchNotices = createAsyncThunk('notices/fetch', () => noticeService.list());

export const fetchChecklist = createAsyncThunk('notices/checklist', (audienceId) =>
  noticeService.checklist(audienceId).then((result) => ({ audienceId, result })));

export const generateNotice = createAsyncThunk(
  'notices/generate',
  async ({ audienceId, language }, { getState, rejectWithValue }) => {
    // Compile the notice text from LIVE data: real activities from the backend plus
    // the company/DPO settings, transfers and vendors (still mock until those become
    // backend features). The server re-checks the register and owns everything else.
    const state = getState();
    const content = buildNoticeContent({
      settings: state.settings.data,
      activities: state.activities.items,
      transfers: state.transfers.items,
      vendors: state.vendors.items,
      audienceId,
      language,
    });
    const title = content.split('\n')[0].replace(/^#\s*/, '');
    try {
      return await noticeService.generate({ audience: audienceId, language, content, title });
    } catch (e) {
      // The backend refuses (422) when the register is incomplete — surface the code
      // so the UI can react; the checklist already shows exactly what is missing.
      if (e.code === 'CHECKLIST_INCOMPLETE') return rejectWithValue({ code: e.code });
      throw e;
    }
  },
);

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
          // The backend returns relevantCount directly (the mock returned relevant[]).
          relevantCount: result.relevantCount ?? result.relevant?.length ?? 0,
        };
      })
      .addCase(fetchChecklist.rejected, (state, action) => {
        state.checklistStatus = 'failed';
        state.error = action.error?.message ?? 'Request failed';
      })
      // generateNotice handled by hand (not addMutationCases) because its rejected
      // case carries the structured checklist code via rejectWithValue.
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
