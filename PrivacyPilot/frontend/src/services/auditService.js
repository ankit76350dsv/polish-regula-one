// Audit trail — read-only from the UI; entries are written exclusively by
// apiMutate so no page can bypass logging.
import { apiGet } from './api';

export const auditService = {
  list: () => apiGet((db) => db.audit.filter(Boolean)),
};
