// Thin wrappers over the Hub notification APIs (RegulaOne backend /api/notifications).
// No state — composed into React Query hooks in hooks/useNotifications.js.

import { api } from '../lib/api';

const BASE = '/api/notifications';
const HUB_MODULE = 'REGULAONE';

const moduleQuery = (module = HUB_MODULE) => {
  const params = new URLSearchParams();
  params.set('module', module);
  return params.toString();
};

export const notificationService = {
  // GET /api/notifications?module=&status=&page=&size=  → Spring Page<NotificationResponse>
  list: ({ module = HUB_MODULE, status, page = 0, size = 20 } = {}) => {
    const params = new URLSearchParams();
    params.set('module', module);
    if (status && status !== 'ALL') params.set('status', status);
    params.set('page', String(page));
    params.set('size', String(size));
    return api.get(`${BASE}?${params.toString()}`);
  },

  // GET /api/notifications/unread-count?module= → { unread: number }
  unreadCount: (module = HUB_MODULE) => api.get(`${BASE}/unread-count?${moduleQuery(module)}`),

  get:        (id, module = HUB_MODULE) => api.get(`${BASE}/${id}?${moduleQuery(module)}`),
  markRead:   (id, module = HUB_MODULE) => api.patch(`${BASE}/${id}/read?${moduleQuery(module)}`),
  markAllRead:(module = HUB_MODULE)     => api.patch(`${BASE}/read-all?${moduleQuery(module)}`),
  archive:    (id, module = HUB_MODULE) => api.patch(`${BASE}/${id}/archive?${moduleQuery(module)}`),
  remove:     (id, module = HUB_MODULE) => api.del(`${BASE}/${id}?${moduleQuery(module)}`),

  getPreferences:    ()     => api.get(`${BASE}/preferences`),
  updatePreferences: (body) => api.put(`${BASE}/preferences`, body),

  // Dev/QA only — creates sample notifications for the current user (backend-gated).
  sendTest: () => api.post(`${BASE}/test`),
};
