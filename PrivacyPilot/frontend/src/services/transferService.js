// Chapter V transfer register — destination, mechanism, TIA documentation.
import { apiGet, apiMutate, newId } from './api';
import { ACTIONS } from '../lib/permissions';

export const transferService = {
  list: () => apiGet((db) => db.transfers),

  create: (actor, data) =>
    apiMutate({
      actor,
      action: ACTIONS.MANAGE_TRANSFERS,
      audit: (transfer) => ({
        action: 'CREATE', entityType: 'transfer', entityId: transfer.id,
        entityLabel: `${transfer.recipient} → ${transfer.destinationCountry}`,
        oldValue: null, newValue: { mechanism: transfer.mechanism },
      }),
      mutator: (db) => {
        const transfer = {
          id: newId('trf'),
          tiaDocumented: false,
          tiaRef: '',
          adequacyNote: '',
          createdAt: new Date().toISOString(),
          ...data,
        };
        db.transfers.unshift(transfer);
        return transfer;
      },
    }),

  update: (actor, id, patch) =>
    apiMutate({
      actor,
      action: ACTIONS.MANAGE_TRANSFERS,
      audit: ({ updated, oldValue, newValue }) => ({
        action: 'UPDATE', entityType: 'transfer', entityId: id,
        entityLabel: `${updated.recipient} → ${updated.destinationCountry}`, oldValue, newValue,
      }),
      mutator: (db) => {
        const idx = db.transfers.findIndex((t) => t.id === id);
        if (idx === -1) throw new Error('NOT_FOUND');
        const before = db.transfers[idx];
        const oldValue = {};
        const newValue = {};
        for (const key of Object.keys(patch)) {
          if (JSON.stringify(before[key]) !== JSON.stringify(patch[key])) {
            oldValue[key] = before[key];
            newValue[key] = patch[key];
          }
        }
        const updated = { ...before, ...patch };
        db.transfers[idx] = updated;
        return { updated, oldValue, newValue };
      },
    }).then((r) => r.updated),
};
