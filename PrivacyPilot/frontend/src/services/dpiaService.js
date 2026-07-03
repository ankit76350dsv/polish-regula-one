// DPIAs — Art. 35 assessments linked to register activities.
import { apiGet, apiMutate, newId } from './api';
import { ACTIONS } from '../lib/permissions';

export const dpiaService = {
  list: () => apiGet((db) => db.dpias),

  get: (id) => apiGet((db) => db.dpias.find((d) => d.id === id) ?? null),

  /** Start a DPIA from an activity's screening result. Carries the matched
   *  criteria over — Frontend B lost them at exactly this hand-off. */
  createForActivity: (actor, activityId) =>
    apiMutate({
      actor,
      action: ACTIONS.MANAGE_DPIA,
      audit: (dpia) => ({
        action: 'CREATE', entityType: 'dpia', entityId: dpia.id,
        entityLabel: dpia.title, oldValue: null, newValue: { status: 'in_progress' },
      }),
      mutator: (db) => {
        const activity = db.activities.find((a) => a.id === activityId);
        if (!activity) throw new Error('NOT_FOUND');
        if (activity.dpiaId) return db.dpias.find((d) => d.id === activity.dpiaId);
        const nowIso = new Date().toISOString();
        const dpia = {
          id: newId('dpia'),
          activityId,
          title: `DPIA — ${activity.name}`,
          status: 'in_progress',
          criteriaMatched: [...(activity.dpiaCriteria ?? [])],
          description: activity.purpose ?? '',
          necessity: '',
          risks: [],
          measures: [],
          dpoAdvice: '',
          priorConsultation: false,
          approvals: [
            { role: 'DPO', name: '', approvedAt: null },
            { role: 'TENANT_ADMIN', name: '', approvedAt: null },
          ],
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        db.dpias.unshift(dpia);
        activity.dpiaId = dpia.id;
        return dpia;
      },
    }),

  update: (actor, id, patch) =>
    apiMutate({
      actor,
      action: ACTIONS.MANAGE_DPIA,
      audit: ({ updated, oldValue, newValue }) => ({
        action: 'UPDATE', entityType: 'dpia', entityId: id,
        entityLabel: updated.title, oldValue, newValue,
      }),
      mutator: (db) => {
        const idx = db.dpias.findIndex((d) => d.id === id);
        if (idx === -1) throw new Error('NOT_FOUND');
        const before = db.dpias[idx];
        const oldValue = {};
        const newValue = {};
        for (const key of Object.keys(patch)) {
          if (JSON.stringify(before[key]) !== JSON.stringify(patch[key])) {
            oldValue[key] = before[key];
            newValue[key] = patch[key];
          }
        }
        const updated = { ...before, ...patch, updatedAt: new Date().toISOString() };
        db.dpias[idx] = updated;
        return { updated, oldValue, newValue };
      },
    }).then((r) => r.updated),

  /** Role-checked sign-off: the actor can only sign the approval slot that
   *  matches their own role. An employee can never sign as DPO. */
  sign: (actor, id) =>
    apiMutate({
      actor,
      action: ACTIONS.SIGN_DPIA,
      audit: (dpia) => ({
        action: 'APPROVE', entityType: 'dpia', entityId: id,
        entityLabel: dpia.title, oldValue: null,
        newValue: { approvedBy: actor.name, asRole: actor.role },
      }),
      mutator: (db) => {
        const dpia = db.dpias.find((d) => d.id === id);
        if (!dpia) throw new Error('NOT_FOUND');
        const slot = dpia.approvals.find((a) => a.role === actor.role && !a.approvedAt);
        if (!slot) {
          const err = new Error('NO_APPROVAL_SLOT');
          err.code = 'NO_APPROVAL_SLOT';
          throw err;
        }
        slot.name = actor.name;
        slot.approvedAt = new Date().toISOString();
        if (dpia.approvals.every((a) => a.approvedAt)) dpia.status = 'approved';
        dpia.updatedAt = new Date().toISOString();
        return dpia;
      },
    }),
};
