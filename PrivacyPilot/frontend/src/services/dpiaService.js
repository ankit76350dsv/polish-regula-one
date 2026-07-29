// DPIAs — Art. 35 risk assessments, each linked to one register activity.
//
// This now talks to the REAL PrivacyPilot backend (DpiaController):
// GET/POST/PUT on /api/privacypilot/dpias plus POST /{id}/sign. It replaced the
// in-browser mock entirely.
//
// What the SERVER owns (so the client can never spoof it):
//   - the tenant (from the verified session) and the audit trail;
//   - the title, matched screening criteria and initial description (copied from
//     the linked activity when the DPIA is opened);
//   - the approval lines and the status (a DPIA turns "approved" only when every
//     line is signed — via the sign endpoint, never through an edit);
//   - RBAC (the caller's role must permit the action, else 403).
import { get, post, put } from './client';

const BASE = '/api/privacypilot/dpias';

/**
 * Turn a full DPIA object into the exact DpiaUpdateRequest the backend expects.
 *
 * It sends ONLY the editable fields (never id/activityId/title/criteria/approvals —
 * those are server-owned). Risk scores are coerced to numbers because the form
 * <Select> gives strings, and the backend validates each score is 1–5.
 * `status` is limited to the three values an edit may set; anything else (e.g. an
 * already-"approved" DPIA) is sent as null so the server keeps the current status.
 */
function toRequest(dpia) {
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    description: dpia.description ?? '',
    necessity: dpia.necessity ?? '',
    risks: (dpia.risks ?? []).map((r) => ({
      id: r.id,
      description: r.description ?? '',
      likelihood: num(r.likelihood),
      severity: num(r.severity),
      mitigation: r.mitigation ?? '',
      residualLikelihood: num(r.residualLikelihood),
      residualSeverity: num(r.residualSeverity),
    })),
    measures: dpia.measures ?? [],
    dpoAdvice: dpia.dpoAdvice ?? '',
    priorConsultation: !!dpia.priorConsultation,
    status: (dpia.status === 'draft' || dpia.status === 'in_progress' || dpia.status === 'rejected')
      ? dpia.status
      : null,
  };
}

export const dpiaService = {
  /** All live DPIAs for the caller's tenant, newest change first. */
  list: () => get(BASE),

  /** One DPIA by id (404 if it is not this tenant's). */
  get: (id) => get(`${BASE}/${id}`),

  /**
   * Open a DPIA for an activity. The server copies the title/criteria/description
   * from that activity and seeds the two sign-off lines. Idempotent: if the activity
   * already has a DPIA, the same one is returned.
   */
  create: (activityId) => post(BASE, { activityId }),

  /**
   * Replace the editable content of a DPIA. The caller passes the FULL current DPIA
   * (the slice merges the small UI patch onto it first) so no field is wiped.
   */
  update: (id, dpia) => put(`${BASE}/${id}`, toRequest(dpia)),

  /** Sign the caller's own approval line; the DPIA turns "approved" when all are signed. */
  sign: (id) => post(`${BASE}/${id}/sign`),
};
