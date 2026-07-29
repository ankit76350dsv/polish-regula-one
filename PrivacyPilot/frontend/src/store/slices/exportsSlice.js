// Exports slice — the audit record written whenever data leaves the app.
//
// Every download, print view and clipboard copy goes through here FIRST; the page only
// produces the file after this thunk fulfils. If it rejects, the export is abandoned and
// the user is told — "no evidence, no copy" (GDPR Art. 5(2) accountability).
//
// There is no list to hold: an export is write-once evidence and is read back through the
// audit-trail slice like any other entry. So this slice keeps only the lifecycle state the
// project rules require (saving / succeeded / failed) plus the last receipt.
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { exportService } from '../../services/exportService';

/**
 * Record an export. Callers should use `.unwrap()` and only write the file on success:
 *   await dispatch(recordExport({ target: 'register_controller', format: 'csv' })).unwrap();
 */
export const recordExport = createAsyncThunk('exports/record', (payload) =>
  exportService.record(payload));

const initialState = {
  // 'idle' | 'saving' | 'succeeded' | 'failed'
  saveStatus: 'idle',
  error: null,
  // The audit entry written for the most recent export, kept as a receipt the UI can show.
  lastReceipt: null,
};

const exportsSlice = createSlice({
  name: 'exports',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(recordExport.pending, (state) => {
        state.saveStatus = 'saving';
        state.error = null;
      })
      .addCase(recordExport.fulfilled, (state, action) => {
        state.saveStatus = 'succeeded';
        state.lastReceipt = action.payload ?? null;
      })
      .addCase(recordExport.rejected, (state, action) => {
        state.saveStatus = 'failed';
        state.error = action.error?.message ?? 'Request failed';
      });
  },
});

export const selectExportStatus = (s) => s.exports.saveStatus;

export default exportsSlice.reducer;
