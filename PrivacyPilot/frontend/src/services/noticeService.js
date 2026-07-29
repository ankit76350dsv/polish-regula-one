// Privacy notices — Art. 13/14 documents compiled from the register.
//
// This now talks to the REAL PrivacyPilot backend (NoticeController):
// GET/POST on /api/privacypilot/notices plus GET /notices/checklist. It replaced
// the in-browser mock.
//
// SPLIT OF RESPONSIBILITY (see the backend NoticeService for the full reasoning):
//   - the server owns the version number, the author, the timestamp, the covered
//     activity links, the audit entry, and the register-completeness GATE (it
//     re-checks the real activities and returns 422 CHECKLIST_INCOMPLETE if the
//     register can't back the notice);
//   - the notice TEXT itself is still compiled on the client (buildNoticeContent),
//     because a full notice also needs the company/DPO identity and vendor/transfer
//     names, which are not backend features yet. The client sends that text; the
//     server governs everything around it.
import { get, post } from './client';

const BASE = '/api/privacypilot/notices';

export const noticeService = {
  /** All notices (every audience, every version) for the caller's tenant, newest first. */
  list: () => get(BASE),

  /**
   * The Art. 13/14 completeness check for one audience, computed from the REAL
   * register. Returns { audience, relevantCount, activityIds, checklist, blocked }.
   * (Identity items — company/DPO — are checked on the client until Settings is a
   * backend feature.)
   */
  checklist: (audience) => get(`${BASE}/checklist?audience=${encodeURIComponent(audience)}`),

  /**
   * Generate a new notice version. The caller passes the already-compiled fields:
   * { audience, language, content, title }. The server sets version/author/time,
   * links the covered activities, and refuses (422) if the register is incomplete.
   */
  generate: ({ audience, language, content, title }) =>
    post(BASE, { audience, language, content, title }),
};
