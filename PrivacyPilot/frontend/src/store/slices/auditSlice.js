// Audit trail slice — read-only, and PAGED.
//
// WHY PAGED: the trail is append-only and kept for ten years, so it is never fetched whole.
// The screen asks for one page (25 rows by default) and the SERVER does the filtering,
// ordering and paging. That is also what makes search CORRECT: it now runs across the entire
// trail. Before, the page fetched one capped batch and filtered it in the browser, so a
// search could report "nothing" for an entry that existed but sat outside that batch.
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { auditService } from '../../services/auditService';

/** Rows per page on the audit screen. Matches the server's default. */
export const AUDIT_PAGE_SIZE = 25;

/**
 * The most rows one export may contain. Equal to the server's hard page ceiling — an export
 * is simply one very large page, so the two limits must not drift.
 */
export const AUDIT_EXPORT_MAX = 1000;

// Turn the screen's filter state into query params, dropping anything not actually set
// ('all' is the UI's "no filter" value for the dropdown).
function filterParams({ q, entityType }) {
  return {
    q: q || undefined,
    entityType: entityType && entityType !== 'all' ? entityType : undefined,
  };
}

/**
 * Load ONE page of the trail.
 * @param {object} [params] { page, size, q, entityType } — all optional.
 */
export const fetchAudit = createAsyncThunk(
  'audit/fetch',
  ({ page = 0, size = AUDIT_PAGE_SIZE, ...filters } = {}) =>
    auditService.list({ page, size, ...filterParams(filters) }),
);

/**
 * Load the rows for an EXPORT: the same filters the user is looking at, but as one big page,
 * so the file holds the whole filtered result rather than just the page on screen.
 *
 * Deliberately does NOT touch the page currently displayed — it returns the rows to the
 * caller, which hands them to the CSV builder.
 */
export const fetchAuditForExport = createAsyncThunk(
  'audit/fetchForExport',
  (filters = {}) =>
    auditService.list({ page: 0, size: AUDIT_EXPORT_MAX, ...filterParams(filters) }),
);

// "page" holds only the counters the pager needs; "items" is the current page's rows.
const emptyPage = {
  number: 0,
  size: AUDIT_PAGE_SIZE,
  totalElements: 0,
  totalPages: 0,
  hasNext: false,
  hasPrevious: false,
};

const auditSlice = createSlice({
  name: 'audit',
  initialState: { items: [], page: emptyPage, status: 'idle', error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAudit.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchAudit.fulfilled, (state, action) => {
        state.status = 'succeeded';
        const p = action.payload ?? {};
        state.items = p.items ?? [];
        state.page = {
          number: p.page ?? 0,
          size: p.size ?? AUDIT_PAGE_SIZE,
          totalElements: p.totalElements ?? 0,
          totalPages: p.totalPages ?? 0,
          hasNext: Boolean(p.hasNext),
          hasPrevious: Boolean(p.hasPrevious),
        };
      })
      .addCase(fetchAudit.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error?.message ?? 'Request failed';
      });
    // fetchAuditForExport intentionally has NO reducers: it must not disturb the page on
    // screen. Its result is handed straight to the export handler.
  },
});

export const selectAuditPage = (s) => s.audit.page;

export default auditSlice.reducer;
