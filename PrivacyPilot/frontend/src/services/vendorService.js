// Processors (Art. 28) with DPA status and sub-processors.
import { apiGet, apiMutate, newId } from './api';
import { ACTIONS } from '../lib/permissions';

export const vendorService = {
  list: () => apiGet((db) => db.vendors),

  create: (actor, data) =>
    apiMutate({
      actor,
      action: ACTIONS.MANAGE_VENDORS,
      audit: (vendor) => ({
        action: 'CREATE', entityType: 'vendor', entityId: vendor.id,
        entityLabel: vendor.name, oldValue: null, newValue: { dpaStatus: vendor.dpaStatus },
      }),
      mutator: (db) => {
        const vendor = {
          id: newId('ven'),
          subprocessors: [],
          riskLevel: 'medium',
          lastReviewAt: null,
          ...data,
        };
        db.vendors.unshift(vendor);
        return vendor;
      },
    }),

  update: (actor, id, patch) =>
    apiMutate({
      actor,
      action: ACTIONS.MANAGE_VENDORS,
      audit: ({ updated, oldValue, newValue }) => ({
        action: 'UPDATE', entityType: 'vendor', entityId: id,
        entityLabel: updated.name, oldValue, newValue,
      }),
      mutator: (db) => {
        const idx = db.vendors.findIndex((v) => v.id === id);
        if (idx === -1) throw new Error('NOT_FOUND');
        const before = db.vendors[idx];
        const oldValue = {};
        const newValue = {};
        for (const key of Object.keys(patch)) {
          if (JSON.stringify(before[key]) !== JSON.stringify(patch[key])) {
            oldValue[key] = before[key];
            newValue[key] = patch[key];
          }
        }
        const updated = { ...before, ...patch };
        db.vendors[idx] = updated;
        return { updated, oldValue, newValue };
      },
    }).then((r) => r.updated),
};
