// Users & roles — invitation and role changes are audited mutations.
import { apiGet, apiMutate, newId } from './api';
import { ACTIONS } from '../lib/permissions';

export const userService = {
  list: () => apiGet((db) => db.users),

  invite: (actor, { name, email, role }) =>
    apiMutate({
      actor,
      action: ACTIONS.MANAGE_USERS,
      audit: (user) => ({
        action: 'INVITE', entityType: 'user', entityId: user.id,
        entityLabel: user.email, oldValue: null, newValue: { role: user.role },
      }),
      mutator: (db) => {
        if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
          const err = new Error('EMAIL_EXISTS');
          err.code = 'EMAIL_EXISTS';
          throw err;
        }
        const user = { id: newId('u'), name, email, role, active: true };
        db.users.push(user);
        return user;
      },
    }),

  changeRole: (actor, id, role) =>
    apiMutate({
      actor,
      action: ACTIONS.MANAGE_USERS,
      audit: ({ user, oldRole }) => ({
        action: 'ROLE_CHANGE', entityType: 'user', entityId: id,
        entityLabel: user.email, oldValue: { role: oldRole }, newValue: { role },
      }),
      mutator: (db) => {
        const user = db.users.find((u) => u.id === id);
        if (!user) throw new Error('NOT_FOUND');
        const oldRole = user.role;
        user.role = role;
        return { user, oldRole };
      },
    }).then((r) => r.user),

  setActive: (actor, id, active) =>
    apiMutate({
      actor,
      action: ACTIONS.MANAGE_USERS,
      audit: ({ user }) => ({
        action: active ? 'ACTIVATE' : 'DEACTIVATE', entityType: 'user', entityId: id,
        entityLabel: user.email, oldValue: { active: !active }, newValue: { active },
      }),
      mutator: (db) => {
        const user = db.users.find((u) => u.id === id);
        if (!user) throw new Error('NOT_FOUND');
        user.active = active;
        return { user };
      },
    }).then((r) => r.user),
};
