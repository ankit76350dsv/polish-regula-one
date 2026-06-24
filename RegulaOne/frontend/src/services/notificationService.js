// Thin wrappers over the Hub notification APIs (RegulaOne backend /api/notifications).
// No state — composed into React Query hooks in hooks/useNotifications.js.

import { api } from '../lib/api';

const BASE = '/api/notifications';

export const notificationService = {
  // GET /api/notifications?status=&page=&size=  → Spring Page<NotificationResponse>
  list: ({ status, page = 0, size = 20 } = {}) => {
    const params = new URLSearchParams();
    if (status && status !== 'ALL') params.set('status', status);
    params.set('page', String(page));
    params.set('size', String(size));
    return api.get(`${BASE}?${params.toString()}`);
  },

  // GET /api/notifications/unread-count → { unread: number }
  unreadCount: () => api.get(`${BASE}/unread-count`),

  get:        (id) => api.get(`${BASE}/${id}`),
  markRead:   (id) => api.patch(`${BASE}/${id}/read`),
  markAllRead:()   => api.patch(`${BASE}/read-all`),
  archive:    (id) => api.patch(`${BASE}/${id}/archive`),
  remove:     (id) => api.del(`${BASE}/${id}`),

  getPreferences:    ()     => api.get(`${BASE}/preferences`),
  updatePreferences: (body) => api.put(`${BASE}/preferences`, body),
};
