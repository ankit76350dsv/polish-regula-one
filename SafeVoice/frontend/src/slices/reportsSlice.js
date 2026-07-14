/**
 * Reports slice — the heart of SafeVoice state.
 *
 * Covers both worlds:
 *   • PUBLIC reporter flow: submit a report, then track it by code + PIN.
 *   • STAFF flow: list cases, open one case, update status/severity/assignment.
 *
 * Every async call goes through reportService (the real backend) and every loading /
 * success / error flag lives here, per the project's Redux rules.
 */
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import reportService from "../services/reportService";
import { statusLabel } from "../services/caseNormalizer";

// ── Thunks ────────────────────────────────────────────────────────────────────
export const fetchReports = createAsyncThunk("reports/fetchAll", () => reportService.listReports());

// One page of the case register (server-side search / filter / pagination). Kept
// separate from fetchReports so the dashboard and inbox (which use the full list)
// are not affected by the register's current page, search, or filter.
export const fetchCasePage = createAsyncThunk("reports/fetchCasePage", (params) =>
  reportService.listReportsPage(params),
);

export const fetchReport = createAsyncThunk("reports/fetchOne", (id) => reportService.getReport(id));

export const submitReport = createAsyncThunk("reports/submit", (payload) =>
  reportService.createReport(payload),
);

export const trackReport = createAsyncThunk(
  "reports/track",
  async ({ accessKey }, { rejectWithValue }) => {
    try {
      return await reportService.trackReport(accessKey);
    } catch (err) {
      return rejectWithValue(err?.errorCode === "NOT_FOUND" ? "notFound" : "error");
    }
  },
);

export const updateReport = createAsyncThunk("reports/update", ({ id, patch }) =>
  reportService.updateReport(id, patch),
);

// PUBLIC reporter posts a message into their own tracked case. Kept here (not in the
// staff messagesSlice) so the anonymous chat uses the public SafeVoice endpoint and
// shares the same `tracked` state the track lookup filled in.
export const sendTrackedMessage = createAsyncThunk(
  "reports/sendTrackedMessage",
  // tenantId is needed so the browser can fetch a one-time key to LOCK the message text; it
  // comes from the tracked report (report.tenantId), not from any login.
  ({ caseId, text, files, accessKey, tenantId }) =>
    reportService.postPublicMessage(caseId, { text, files, accessKey, tenantId }),
);

// Reporter marks ONE staff message read — optimistic (flip state now) + persist to the backend.
export const trackedMessageReadPersist = createAsyncThunk(
  "reports/trackReadOne",
  async ({ caseId, messageId, accessKey }, { dispatch }) => {
    dispatch(trackedMessageRead({ messageId }));
    await reportService.markPublicRead({ caseId, accessKey, messageId });
  },
);

// Reporter marks the WHOLE thread read — optimistic + persist (used on reply).
export const trackedThreadReadPersist = createAsyncThunk(
  "reports/trackReadAll",
  async ({ caseId, accessKey }, { dispatch }) => {
    dispatch(trackedThreadRead());
    await reportService.markPublicRead({ caseId, accessKey });
  },
);

// ── Slice ───────────────────────────────────────────────────────────────────
const initialState = {
  list: [],
  listStatus: "idle",
  listError: null,

  // The staff "case register" — one server-side page at a time, with its own
  // search/filter/paging meta, kept apart from the full `list` above.
  register: {
    items: [],
    page: 1,
    size: 8,
    total: 0,
    totalPages: 0,
    status: "idle",
    error: null,
  },

  current: null,
  currentStatus: "idle",
  currentError: null,

  submitStatus: "idle",
  submitError: null,
  lastSubmission: null, // { accessKey, isHrOnly }

  tracked: null, // { report, messages }
  trackStatus: "idle",
  trackError: null, // 'notFound' | 'error' | null
  trackSending: false, // true while the reporter's new message is being posted

  updating: false,
};

const reportsSlice = createSlice({
  name: "reports",
  initialState,
  reducers: {
    clearSubmission(state) {
      state.submitStatus = "idle";
      state.submitError = null;
      state.lastSubmission = null;
    },
    clearTracked(state) {
      state.tracked = null;
      state.trackStatus = "idle";
      state.trackError = null;
    },
    // A new case arrived live over WebSocket. Put it at the top of both the full list
    // (used by the Inbox/Dashboard) and the register page (the Cases table), unless it is
    // already there — so it shows up without a refresh and never appears twice.
    caseReceived(state, action) {
      const incoming = action.payload;
      if (!incoming || !incoming.id) return;
      if (!state.list.some((r) => r.id === incoming.id)) {
        state.list.unshift(incoming);
      }
      if (!state.register.items.some((r) => r.id === incoming.id)) {
        state.register.items.unshift(incoming);
        state.register.total += 1;
      }
    },
    // A chat message arrived live over WebSocket for the reporter's currently tracked case.
    // Append it unless already present (the reporter also receives their own broadcast, and
    // the REST reply may have added it first).
    trackedMessageReceived(state, action) {
      const message = action.payload;
      if (!state.tracked || !message?.id) return;
      if (!state.tracked.messages.some((m) => m.id === message.id)) {
        state.tracked.messages.push(message);
      }
    },
    // Reporter marks ONE staff message read (readByReporter). State-only; clears the highlight.
    trackedMessageRead(state, action) {
      const msg = state.tracked?.messages?.find((m) => m.id === action.payload?.messageId);
      if (msg) msg.readByReporter = true;
    },
    // Reporter marks the WHOLE thread read — used when they reply, so every previously-unread
    // staff message loses its highlight at once.
    trackedThreadRead(state) {
      (state.tracked?.messages || []).forEach((m) => { m.readByReporter = true; });
    },
    // Staff read the whole thread → the case's "unread by staff" badge drops to 0 in every list
    // (inbox + register), so the badge matches the thread without waiting for a refetch.
    caseUnreadCleared(state, action) {
      const { caseId } = action.payload || {};
      const clear = (r) => { if (r && r.id === caseId) r.unreadCount = 0; };
      state.list.forEach(clear);
      state.register.items.forEach(clear);
    },
    // Staff read ONE message → drop the badge by one (never below zero).
    caseUnreadDecremented(state, action) {
      const { caseId } = action.payload || {};
      const dec = (r) => { if (r && r.id === caseId && r.unreadCount > 0) r.unreadCount -= 1; };
      state.list.forEach(dec);
      state.register.items.forEach(dec);
    },
    // A case's STATUS changed live over WebSocket (a CASE_UPDATE frame). Apply it EVERYWHERE the
    // case might be shown so every surface stays in sync with the backend without a refresh:
    // the reporter's tracked case, the staff open case, and both staff lists (inbox + register).
    // Status enum is mapped to its friendly label, exactly like normalizeReport does.
    caseStatusUpdated(state, action) {
      const { caseId, status, closedAt } = action.payload || {};
      if (!caseId) return;
      const label = status != null ? statusLabel(status) : undefined;
      const apply = (r) => {
        if (!r || r.id !== caseId) return;
        if (label !== undefined) r.status = label;
        if (closedAt !== undefined) r.closedAt = closedAt; // null clears it (case reopened)
      };
      apply(state.current);
      if (state.tracked?.report) apply(state.tracked.report);
      state.list.forEach(apply);
      state.register.items.forEach(apply);
    },
    // A case had activity (a message) somewhere in the tenant. Move it to the TOP of both
    // lists (most-recent-activity first, like a chat app), and — when the reporter wrote and
    // the viewer is not already on that case — bump its unread badge. `incrementUnread` is
    // decided by the caller (it knows which case is currently open).
    caseActivity(state, action) {
      const { caseId, incrementUnread } = action.payload;
      const moveToTop = (arr) => {
        const i = arr.findIndex((r) => r.id === caseId);
        if (i === -1) return; // not in this loaded page → next fetch will order it correctly
        const [row] = arr.splice(i, 1);
        if (incrementUnread) row.unreadCount = (row.unreadCount || 0) + 1;
        arr.unshift(row);
      };
      moveToTop(state.list);
      moveToTop(state.register.items);
    },
  },
  extraReducers: (builder) => {
    builder
      // list
      .addCase(fetchReports.pending, (s) => {
        s.listStatus = "loading";
        s.listError = null;
      })
      .addCase(fetchReports.fulfilled, (s, a) => {
        s.listStatus = "succeeded";
        s.list = a.payload;
      })
      .addCase(fetchReports.rejected, (s, a) => {
        s.listStatus = "failed";
        s.listError = a.error?.message || "error";
      })
      // register page (search / filter / pagination)
      .addCase(fetchCasePage.pending, (s) => {
        s.register.status = "loading";
        s.register.error = null;
      })
      .addCase(fetchCasePage.fulfilled, (s, a) => {
        s.register.status = "succeeded";
        s.register.items = a.payload.items;
        s.register.page = a.payload.page;
        s.register.size = a.payload.size;
        s.register.total = a.payload.total;
        s.register.totalPages = a.payload.totalPages;
      })
      .addCase(fetchCasePage.rejected, (s, a) => {
        s.register.status = "failed";
        s.register.error = a.error?.message || "error";
      })
      // one
      .addCase(fetchReport.pending, (s) => {
        s.currentStatus = "loading";
        s.currentError = null;
        s.current = null;
      })
      .addCase(fetchReport.fulfilled, (s, a) => {
        s.currentStatus = "succeeded";
        s.current = a.payload;
      })
      .addCase(fetchReport.rejected, (s, a) => {
        s.currentStatus = "failed";
        s.currentError = a.error?.message || "error";
      })
      // submit
      .addCase(submitReport.pending, (s) => {
        s.submitStatus = "loading";
        s.submitError = null;
      })
      .addCase(submitReport.fulfilled, (s, a) => {
        s.submitStatus = "succeeded";
        s.lastSubmission = a.payload;
      })
      .addCase(submitReport.rejected, (s, a) => {
        s.submitStatus = "failed";
        s.submitError = a.error?.message || "error";
      })
      // track
      .addCase(trackReport.pending, (s) => {
        s.trackStatus = "loading";
        s.trackError = null;
      })
      .addCase(trackReport.fulfilled, (s, a) => {
        s.trackStatus = "succeeded";
        s.tracked = a.payload;
      })
      .addCase(trackReport.rejected, (s, a) => {
        s.trackStatus = "failed";
        s.trackError = a.payload || "error";
        s.tracked = null;
      })
      // update (status/severity/assignment)
      .addCase(updateReport.pending, (s) => {
        s.updating = true;
      })
      .addCase(updateReport.fulfilled, (s, a) => {
        s.updating = false;
        s.current = a.payload;
        // keep the list row in sync
        const i = s.list.findIndex((r) => r.id === a.payload.id);
        if (i !== -1) s.list[i] = a.payload;
      })
      .addCase(updateReport.rejected, (s) => {
        s.updating = false;
      })
      // reporter posts a message into their tracked case
      .addCase(sendTrackedMessage.pending, (s) => {
        s.trackSending = true;
      })
      .addCase(sendTrackedMessage.fulfilled, (s, a) => {
        s.trackSending = false;
        // Show the just-sent message immediately. Dedup in case the live WebSocket
        // broadcast already added it.
        if (s.tracked && !s.tracked.messages.some((m) => m.id === a.payload.id)) {
          s.tracked.messages.push(a.payload);
        }
      })
      .addCase(sendTrackedMessage.rejected, (s) => {
        s.trackSending = false;
      });
  },
});

export const {
  clearSubmission,
  clearTracked,
  caseReceived,
  trackedMessageReceived,
  trackedMessageRead,
  trackedThreadRead,
  caseUnreadCleared,
  caseUnreadDecremented,
  caseStatusUpdated,
  caseActivity,
} = reportsSlice.actions;

// ── Selectors ─────────────────────────────────────────────────────────────────
export const selectReports = (s) => s.reports.list;
export const selectReportsStatus = (s) => s.reports.listStatus;
export const selectRegister = (s) => s.reports.register;
export const selectCurrentReport = (s) => s.reports.current;
export const selectCurrentStatus = (s) => s.reports.currentStatus;
export const selectSubmitStatus = (s) => s.reports.submitStatus;
export const selectLastSubmission = (s) => s.reports.lastSubmission;
export const selectTracked = (s) => s.reports.tracked;
export const selectTrackStatus = (s) => s.reports.trackStatus;
export const selectTrackError = (s) => s.reports.trackError;
export const selectTrackSending = (s) => s.reports.trackSending;
export const selectUpdating = (s) => s.reports.updating;

export default reportsSlice.reducer;
