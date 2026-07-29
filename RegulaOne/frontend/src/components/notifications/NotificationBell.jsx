// Header notification bell: shows the unread badge and a dropdown preview of recent items.
// Polls the unread count every 30s (real-time SSE arrives in a later phase).

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Check, Loader2, Settings2, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '../../store/authStore';
import {
  useUnreadCount, useNotifications, useMarkRead, useMarkAllRead,
} from '../../hooks/useNotifications';
import { severityStyle, relativeTime } from '../../lib/notificationsUi';

export default function NotificationBell() {
  const tid = useAuthStore((s) => s.user?.tenantId) ?? 'platform';
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: unread = 0 } = useUnreadCount();
  // Only fetch the preview list while the dropdown is open.
  const { data: page, isLoading } = useNotifications({ size: 6, enabled: open });
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const items = page?.content ?? [];
  const centerPath = `/company/${tid}/notifications`;

  const openItem = (n) => {
    if (n.status === 'UNREAD') markRead.mutate(n.id);
    setOpen(false);
    navigate(centerPath);
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="text-slate-400 hover:text-slate-700 relative"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Button>

      {open && (
        <>
          {/* Click-away backdrop */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />

          <div className="absolute right-0 mt-2 w-96 max-w-[92vw] bg-white border border-slate-200 rounded-xl shadow-lg z-40 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Notifications</span>
              {unread > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-red-600 transition-colors"
                >
                  {markAllRead.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-50">
              {isLoading ? (
                <div className="px-4 py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
              ) : items.length === 0 ? (
                <div className="px-4 py-10 flex flex-col items-center gap-2 text-slate-400">
                  <Inbox className="h-8 w-8 text-slate-200" />
                  <p className="text-xs font-medium">You're all caught up</p>
                </div>
              ) : (
                items.map((n) => {
                  const s = severityStyle(n.severity);
                  const isUnread = n.status === 'UNREAD';
                  return (
                    <button
                      key={n.id}
                      onClick={() => openItem(n)}
                      className={`w-full text-left px-4 py-3 flex gap-3 transition-colors hover:bg-slate-50 ${isUnread ? 'bg-red-50/30' : ''}`}
                    >
                      <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${isUnread ? s.dot : 'bg-slate-200'}`} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className={`text-xs truncate ${isUnread ? 'font-bold text-slate-800' : 'font-semibold text-slate-600'}`}>{n.title}</span>
                          <span className="text-[10px] text-slate-400 flex-shrink-0">{relativeTime(n.createdAt)}</span>
                        </span>
                        {n.body && <span className="block text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-snug">{n.body}</span>}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
              <Link to={centerPath} onClick={() => setOpen(false)} className="text-[11px] font-bold text-red-600 hover:underline">
                View all notifications
              </Link>
              <Link
                to={`${centerPath}/preferences`}
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-700"
              >
                <Settings2 className="h-3 w-3" /> Preferences
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
