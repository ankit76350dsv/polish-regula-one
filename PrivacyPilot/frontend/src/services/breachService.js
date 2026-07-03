// Personal data breach register — ALL breaches documented (Art. 33(5)),
// with the real 72-hour UODO notification clock computed from discoveredAt.
import { apiGet, apiMutate, newId } from './api';
import { ACTIONS } from '../lib/permissions';

export const UODO_WINDOW_MS = 72 * 60 * 60 * 1000;

/** Live clock helper used by list and detail pages. */
export function breachClock(breach) {
  if (!breach.uodoNotificationRequired) return { applicable: false };
  if (breach.uodoNotifiedAt) return { applicable: true, notified: true };
  const elapsed = Date.now() - new Date(breach.discoveredAt).getTime();
  const remainingMs = UODO_WINDOW_MS - elapsed;
  return { applicable: true, notified: false, remainingMs, expired: remainingMs <= 0 };
}

export const breachService = {
  list: () => apiGet((db) => db.breaches),

  get: (id) => apiGet((db) => db.breaches.find((b) => b.id === id) ?? null),

  create: (actor, data) =>
    apiMutate({
      actor,
      action: ACTIONS.MANAGE_BREACHES,
      audit: (breach) => ({
        action: 'CREATE', entityType: 'breach', entityId: breach.id,
        entityLabel: breach.title, oldValue: null, newValue: { status: 'open' },
      }),
      mutator: (db) => {
        const nowIso = new Date().toISOString();
        const breach = {
          id: newId('br'),
          status: 'open',
          discoveredAt: nowIso,
          uodoNotifiedAt: null,
          remediation: [],
          ...data,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        db.breaches.unshift(breach);
        return breach;
      },
    }),

  update: (actor, id, patch) =>
    apiMutate({
      actor,
      action: ACTIONS.MANAGE_BREACHES,
      audit: ({ updated, oldValue, newValue }) => ({
        action: 'UPDATE', entityType: 'breach', entityId: id,
        entityLabel: updated.title, oldValue, newValue,
      }),
      mutator: (db) => {
        const idx = db.breaches.findIndex((b) => b.id === id);
        if (idx === -1) throw new Error('NOT_FOUND');
        const before = db.breaches[idx];
        const oldValue = {};
        const newValue = {};
        for (const key of Object.keys(patch)) {
          if (JSON.stringify(before[key]) !== JSON.stringify(patch[key])) {
            oldValue[key] = before[key];
            newValue[key] = patch[key];
          }
        }
        const updated = { ...before, ...patch, updatedAt: new Date().toISOString() };
        db.breaches[idx] = updated;
        return { updated, oldValue, newValue };
      },
    }).then((r) => r.updated),

  /** Record that the UODO notification was submitted (timestamped). */
  markNotified: (actor, id) =>
    apiMutate({
      actor,
      action: ACTIONS.MANAGE_BREACHES,
      audit: (breach) => ({
        action: 'UODO_NOTIFIED', entityType: 'breach', entityId: id,
        entityLabel: breach.title, oldValue: { uodoNotifiedAt: null },
        newValue: { uodoNotifiedAt: breach.uodoNotifiedAt },
      }),
      mutator: (db) => {
        const breach = db.breaches.find((b) => b.id === id);
        if (!breach) throw new Error('NOT_FOUND');
        breach.uodoNotifiedAt = new Date().toISOString();
        breach.updatedAt = breach.uodoNotifiedAt;
        return breach;
      },
    }),
};
