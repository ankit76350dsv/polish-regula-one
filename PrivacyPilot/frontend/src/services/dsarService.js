// Data subject requests (Arts. 15–22).
// Deadline engine: 1 month from receipt (Art. 12(3)), extendable by TWO
// further months for complex/numerous requests — the requester must be told
// within the first month. Both prototypes had this wrong or hardcoded.
import { apiGet, apiMutate, newId } from './api';
import { ACTIONS } from '../lib/permissions';

function addMonths(dateIso, months) {
  const d = new Date(dateIso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

/** Days remaining until the deadline; negative = overdue. */
export function dsarDaysLeft(dsar) {
  return Math.ceil((new Date(dsar.dueAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export const dsarService = {
  list: () => apiGet((db) => db.dsars),

  get: (id) => apiGet((db) => db.dsars.find((r) => r.id === id) ?? null),

  create: (actor, data) =>
    apiMutate({
      actor,
      action: ACTIONS.MANAGE_DSAR,
      audit: (dsar) => ({
        action: 'CREATE', entityType: 'dsar', entityId: dsar.id,
        entityLabel: `${dsar.type} — ${dsar.requesterName}`, oldValue: null,
        newValue: { dueAt: dsar.dueAt },
      }),
      mutator: (db) => {
        const nowIso = new Date().toISOString();
        const receivedAt = data.receivedAt ?? nowIso;
        const dsar = {
          id: newId('dsar'),
          status: 'in_progress',
          extended: false,
          identityVerified: false,   // never auto-verified — a human confirms it
          identityMethod: '',
          tasks: [],
          notes: '',
          ...data,
          receivedAt,
          dueAt: addMonths(receivedAt, 1),
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        db.dsars.unshift(dsar);
        return dsar;
      },
    }),

  update: (actor, id, patch) =>
    apiMutate({
      actor,
      action: ACTIONS.MANAGE_DSAR,
      audit: ({ updated, oldValue, newValue }) => ({
        action: 'UPDATE', entityType: 'dsar', entityId: id,
        entityLabel: `${updated.type} — ${updated.requesterName}`, oldValue, newValue,
      }),
      mutator: (db) => {
        const idx = db.dsars.findIndex((r) => r.id === id);
        if (idx === -1) throw new Error('NOT_FOUND');
        const before = db.dsars[idx];
        const oldValue = {};
        const newValue = {};
        for (const key of Object.keys(patch)) {
          if (JSON.stringify(before[key]) !== JSON.stringify(patch[key])) {
            oldValue[key] = before[key];
            newValue[key] = patch[key];
          }
        }
        const updated = { ...before, ...patch, updatedAt: new Date().toISOString() };
        db.dsars[idx] = updated;
        return { updated, oldValue, newValue };
      },
    }).then((r) => r.updated),

  /** Art. 12(3) extension: +2 months on top of the original 1-month deadline. */
  extend: (actor, id, reason) =>
    apiMutate({
      actor,
      action: ACTIONS.MANAGE_DSAR,
      audit: (dsar) => ({
        action: 'EXTEND', entityType: 'dsar', entityId: id,
        entityLabel: `${dsar.type} — ${dsar.requesterName}`,
        oldValue: { extended: false }, newValue: { extended: true, dueAt: dsar.dueAt },
      }),
      mutator: (db) => {
        const dsar = db.dsars.find((r) => r.id === id);
        if (!dsar) throw new Error('NOT_FOUND');
        if (dsar.extended) throw new Error('ALREADY_EXTENDED');
        dsar.extended = true;
        dsar.extensionReason = reason;
        dsar.dueAt = addMonths(dsar.receivedAt, 3); // 1 month + 2 further months
        dsar.updatedAt = new Date().toISOString();
        return dsar;
      },
    }),

  complete: (actor, id) =>
    apiMutate({
      actor,
      action: ACTIONS.MANAGE_DSAR,
      audit: (dsar) => ({
        action: 'COMPLETE', entityType: 'dsar', entityId: id,
        entityLabel: `${dsar.type} — ${dsar.requesterName}`,
        oldValue: { status: 'in_progress' }, newValue: { status: 'completed' },
      }),
      mutator: (db) => {
        const dsar = db.dsars.find((r) => r.id === id);
        if (!dsar) throw new Error('NOT_FOUND');
        dsar.status = 'completed';
        dsar.completedAt = new Date().toISOString();
        dsar.updatedAt = dsar.completedAt;
        return dsar;
      },
    }),
};
