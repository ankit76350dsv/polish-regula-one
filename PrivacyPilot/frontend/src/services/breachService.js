// Personal data breach register (Art. 33–34).
//
// This now talks to the REAL PrivacyPilot backend (BreachController):
// GET/POST/PUT on /api/privacypilot/breaches plus POST /{id}/notify-uodo and
// POST /{id}/notify-subjects. It replaced the in-browser mock.
//
// The 72-hour UODO clock is still computed on the client from discoveredAt (nothing
// extra is stored). The two "notified at" moments are server-stamped by their own
// actions, so an ordinary edit can never fake a notification. There is NO delete — a
// breach is an accountability record that must be kept (Art. 33(5)).
import { get, post, put } from './client';

const BASE = '/api/privacypilot/breaches';

export const UODO_WINDOW_MS = 72 * 60 * 60 * 1000;

/** Live clock helper used by the list, detail and dashboard pages. */
export function breachClock(breach) {
  if (!breach.uodoNotificationRequired) return { applicable: false };
  if (breach.uodoNotifiedAt) return { applicable: true, notified: true };
  const elapsed = Date.now() - new Date(breach.discoveredAt).getTime();
  const remainingMs = UODO_WINDOW_MS - elapsed;
  return { applicable: true, notified: false, remainingMs, expired: remainingMs <= 0 };
}

/**
 * Map a breach object to the exact BreachRequest the backend expects — only the
 * editable fields. The server owns the two "notified at" moments and the timestamps.
 */
function toRequest(b) {
  return {
    title: b.title,
    riskLevel: b.riskLevel || null,
    description: b.description,
    subjectsCount: Number(b.subjectsCount) || 0,
    recordsCount: Number(b.recordsCount) || 0,
    dataCategories: b.dataCategories ?? [],
    uodoNotificationRequired: !!b.uodoNotificationRequired,
    subjectsNotificationRequired: !!b.subjectsNotificationRequired,
    riskRationale: b.riskRationale ?? '',
    // Optional — when the client sends it the server uses it; create defaults to now.
    discoveredAt: b.discoveredAt ?? null,
    // open/closed only; create forces OPEN server-side.
    status: (b.status === 'open' || b.status === 'closed') ? b.status : null,
    uodoReference: b.uodoReference ?? null,
    remediation: (b.remediation ?? []).map((r) => ({
      id: r.id,
      text: r.text,
      done: !!r.done,
    })),
  };
}

export const breachService = {
  /** All breaches for the caller's tenant, most recently recorded first. */
  list: () => get(BASE),

  /** One breach by id (404 if it is not this tenant's). */
  get: (id) => get(`${BASE}/${id}`),

  /** Record a new breach (starts OPEN; the 72h clock runs from discoveredAt). */
  create: (data) => post(BASE, toRequest(data)),

  /**
   * Update a breach. The backend PUT replaces the whole record, so the caller passes
   * the FULL current breach (the slice merges the small UI patch onto it).
   */
  update: (id, data) => put(`${BASE}/${id}`, toRequest(data)),

  /** Record that UODO has now been notified — the server stamps the moment. */
  markNotified: (id) => post(`${BASE}/${id}/notify-uodo`),

  /** Record that the affected people have now been told directly (Art. 34). */
  markSubjectsNotified: (id) => post(`${BASE}/${id}/notify-subjects`),
};
