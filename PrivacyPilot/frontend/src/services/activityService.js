// ROPA activities — Art. 30 register records.
import { apiGet, apiMutate, newId } from './api';
import { ACTIONS } from '../lib/permissions';
import { evaluateDpia } from '../lib/dpiaCriteria';

export const activityService = {
  list: () => apiGet((db) => db.activities),

  get: (id) => apiGet((db) => db.activities.find((a) => a.id === id) ?? null),

  create: (actor, data) =>
    apiMutate({
      actor,
      action: ACTIONS.CREATE_ACTIVITY,
      audit: (activity) => ({
        action: 'CREATE', entityType: 'activity', entityId: activity.id,
        entityLabel: activity.name, oldValue: null, newValue: { status: activity.status },
      }),
      mutator: (db) => {
        const nowIso = new Date().toISOString();
        const activity = {
          id: newId('act'),
          status: 'draft',
          dpiaId: null,
          ...data,
          dpiaVerdict: evaluateDpia(data.dpiaCriteria ?? []).verdict,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        db.activities.unshift(activity);
        return activity;
      },
    }),

  update: (actor, id, patch) =>
    apiMutate({
      actor,
      action: ACTIONS.EDIT_ACTIVITY,
      // Diff computed in the mutator so the audit trail shows exactly what changed.
      audit: ({ updated, oldValue, newValue }) => ({
        action: 'UPDATE', entityType: 'activity', entityId: id,
        entityLabel: updated.name, oldValue, newValue,
      }),
      mutator: (db) => {
        const idx = db.activities.findIndex((a) => a.id === id);
        if (idx === -1) throw new Error('NOT_FOUND');
        const before = db.activities[idx];
        const oldValue = {};
        const newValue = {};
        for (const key of Object.keys(patch)) {
          if (JSON.stringify(before[key]) !== JSON.stringify(patch[key])) {
            oldValue[key] = before[key];
            newValue[key] = patch[key];
          }
        }
        const updated = {
          ...before,
          ...patch,
          dpiaVerdict: evaluateDpia(patch.dpiaCriteria ?? before.dpiaCriteria ?? []).verdict,
          updatedAt: new Date().toISOString(),
        };
        db.activities[idx] = updated;
        return { updated, oldValue, newValue };
      },
    }).then((r) => r.updated),

  /** Archive, never hard-delete — a compliance register must keep history. */
  archive: (actor, id) =>
    apiMutate({
      actor,
      action: ACTIONS.DELETE_ACTIVITY,
      audit: (activity) => ({
        action: 'ARCHIVE', entityType: 'activity', entityId: id,
        entityLabel: activity.name, oldValue: { status: activity._prevStatus }, newValue: { status: 'archived' },
      }),
      mutator: (db) => {
        const activity = db.activities.find((a) => a.id === id);
        if (!activity) throw new Error('NOT_FOUND');
        activity._prevStatus = activity.status;
        activity.status = 'archived';
        activity.updatedAt = new Date().toISOString();
        return activity;
      },
    }),

  approve: (actor, id) =>
    apiMutate({
      actor,
      action: ACTIONS.APPROVE_ACTIVITY,
      audit: (activity) => ({
        action: 'APPROVE', entityType: 'activity', entityId: id,
        entityLabel: activity.name, oldValue: { status: activity._prevStatus }, newValue: { status: 'approved' },
      }),
      mutator: (db) => {
        const activity = db.activities.find((a) => a.id === id);
        if (!activity) throw new Error('NOT_FOUND');
        activity._prevStatus = activity.status;
        activity.status = 'approved';
        activity.updatedAt = new Date().toISOString();
        return activity;
      },
    }),
};
