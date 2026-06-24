// React Query hooks for the notification Hub. Mirrors the pattern in useTeam.js.
//
// - useUnreadCount(): badge number, auto-refreshes every 30s (poll until SSE lands in Phase 4).
// - useNotifications(): paginated list, optionally filtered by status.
// - mutations: mark read / mark all read / archive / delete — all invalidate the caches.
// - usePreferences() / useUpdatePreferences(): per-user channel settings.

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { notificationService } from '../services/notificationService';

export const NOTIF_KEYS = {
  all:    ['notifications'],
  list:   (status, page) => ['notifications', 'list', status ?? 'ALL', page ?? 0],
  unread: ['notifications', 'unread'],
  prefs:  ['notifications', 'prefs'],
};

// Unread badge count. Polls every 30s and on window focus so the bell stays current.
export function useUnreadCount() {
  return useQuery({
    queryKey: NOTIF_KEYS.unread,
    queryFn:  () => notificationService.unreadCount(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    select: (d) => d?.unread ?? 0,
  });
}

// Paginated list. `enabled` lets the bell fetch its preview only when opened.
export function useNotifications({ status, page = 0, size = 20, enabled = true } = {}) {
  return useQuery({
    queryKey: NOTIF_KEYS.list(status, page),
    queryFn:  () => notificationService.list({ status, page, size }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

// Shared invalidation — after any change, refresh both the lists and the badge.
function useRefreshNotifications() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: NOTIF_KEYS.all });
}

export function useMarkRead() {
  const refresh = useRefreshNotifications();
  return useMutation({
    mutationFn: (id) => notificationService.markRead(id),
    onSuccess: refresh,
    onError: (e) => toast.error(e.message ?? 'Failed to mark as read'),
  });
}

export function useMarkAllRead() {
  const refresh = useRefreshNotifications();
  return useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => { refresh(); toast.success('All notifications marked as read'); },
    onError: (e) => toast.error(e.message ?? 'Failed to mark all as read'),
  });
}

export function useArchiveNotification() {
  const refresh = useRefreshNotifications();
  return useMutation({
    mutationFn: (id) => notificationService.archive(id),
    onSuccess: refresh,
    onError: (e) => toast.error(e.message ?? 'Failed to archive'),
  });
}

export function useDeleteNotification() {
  const refresh = useRefreshNotifications();
  return useMutation({
    mutationFn: (id) => notificationService.remove(id),
    onSuccess: () => { refresh(); toast.success('Notification deleted'); },
    onError: (e) => toast.error(e.message ?? 'Failed to delete'),
  });
}

// Dev/QA helper — generate sample notifications for yourself and refresh the lists.
export function useSendTestNotifications() {
  const refresh = useRefreshNotifications();
  return useMutation({
    mutationFn: () => notificationService.sendTest(),
    onSuccess: (res) => { refresh(); toast.success(`Created ${res?.created ?? ''} test notifications`); },
    onError: (e) => toast.error(e.message ?? 'Failed to create test notifications'),
  });
}

export function usePreferences() {
  return useQuery({
    queryKey: NOTIF_KEYS.prefs,
    queryFn:  () => notificationService.getPreferences(),
  });
}

export function useUpdatePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => notificationService.updatePreferences(body),
    onSuccess: () => { toast.success('Preferences saved'); qc.invalidateQueries({ queryKey: NOTIF_KEYS.prefs }); },
    onError: (e) => toast.error(e.message ?? 'Failed to save preferences'),
  });
}
