// Company + DPO settings, including the Polish DPO/UODO notification tracker
// (Art. 10–11, Act of 10 May 2018: 14 days, electronic only).
import { apiGet, apiMutate } from './api';
import { ACTIONS } from '../lib/permissions';

/** Days remaining in the 14-day UODO notification window; null when not applicable. */
export function uodoWindow(dpo) {
  if (!dpo?.appointedAt || dpo.uodoNotifiedAt) return null;
  const deadline = new Date(dpo.appointedAt).getTime() + 14 * 24 * 60 * 60 * 1000;
  return Math.ceil((deadline - Date.now()) / (24 * 60 * 60 * 1000));
}

export const settingsService = {
  get: () => apiGet((db) => db.settings),

  update: (actor, patch) =>
    apiMutate({
      actor,
      action: ACTIONS.EDIT_SETTINGS,
      audit: ({ oldValue, newValue }) => ({
        action: 'UPDATE', entityType: 'settings', entityId: 'settings',
        entityLabel: 'Company settings', oldValue, newValue,
      }),
      mutator: (db) => {
        const before = db.settings;
        const updated = {
          company: { ...before.company, ...(patch.company ?? {}) },
          dpo: { ...before.dpo, ...(patch.dpo ?? {}) },
          ai: { ...before.ai, ...(patch.ai ?? {}) },
        };
        // Shallow diff on all sections for the audit entry.
        const oldValue = {};
        const newValue = {};
        for (const section of ['company', 'dpo', 'ai']) {
          for (const key of Object.keys(patch[section] ?? {})) {
            if (before[section][key] !== updated[section][key]) {
              oldValue[`${section}.${key}`] = before[section][key];
              newValue[`${section}.${key}`] = updated[section][key];
            }
          }
        }
        db.settings = updated;
        return { updated, oldValue, newValue };
      },
    }).then((r) => r.updated),
};
