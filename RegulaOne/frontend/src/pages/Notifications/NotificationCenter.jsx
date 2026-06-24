// Notification Center — the full list of the current user's notifications, with status
// filtering, pagination, and per-item actions (mark read / archive / delete).

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Bell, Check, Archive, Trash2, Loader2, AlertTriangle, Inbox, Settings2, ChevronLeft, ChevronRight, FlaskConical,
} from 'lucide-react';
import {
  useNotifications, useMarkRead, useMarkAllRead, useArchiveNotification, useDeleteNotification, useSendTestNotifications,
} from '../../hooks/useNotifications';
import { severityStyle, relativeTime } from '../../lib/notificationsUi';

const TABS = [
  { key: 'ALL',      label: 'All' },
  { key: 'UNREAD',   label: 'Unread' },
  { key: 'READ',     label: 'Read' },
  { key: 'ARCHIVED', label: 'Archived' },
];

export default function NotificationCenter() {
  const { tenantId } = useParams();
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(0);

  const { data, isLoading, error } = useNotifications({ status, page, size: 20 });
  const markRead   = useMarkRead();
  const markAllRead = useMarkAllRead();
  const archive    = useArchiveNotification();
  const remove     = useDeleteNotification();
  const sendTest   = useSendTestNotifications();

  const items      = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;
  const totalItems = data?.totalElements ?? 0;

  const changeTab = (key) => { setStatus(key); setPage(0); };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
            <Bell className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Notifications</h2>
            <p className="text-sm text-slate-500 font-medium">{totalItems} {status === 'ALL' ? 'total' : status.toLowerCase()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-xs font-bold text-slate-500 hover:text-amber-600"
            onClick={() => sendTest.mutate()} disabled={sendTest.isPending} title="Generate sample notifications (dev)">
            {sendTest.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FlaskConical className="h-3.5 w-3.5 mr-1" />}
            Send test
          </Button>
          <Button variant="ghost" size="sm" className="text-xs font-bold text-slate-500 hover:text-red-600"
            onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
            {markAllRead.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
            Mark all read
          </Button>
          <Link to={`/company/${tenantId}/notifications/preferences`}>
            <Button variant="ghost" size="sm" className="text-xs font-bold text-slate-500 hover:text-red-600">
              <Settings2 className="h-3.5 w-3.5 mr-1" /> Preferences
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Status tabs ────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => changeTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              status === t.key ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── List ───────────────────────────────────────────────────────────── */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <CardContent className="p-0">
          {error ? (
            <div className="px-6 py-10 flex flex-col items-center gap-2 text-rose-500">
              <AlertTriangle className="h-6 w-6" />
              <p className="text-sm font-medium">Failed to load notifications</p>
              <p className="text-xs text-slate-400">{error.message}</p>
            </div>
          ) : isLoading ? (
            <div className="px-6 py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
          ) : items.length === 0 ? (
            <div className="px-6 py-16 flex flex-col items-center gap-3 text-slate-400">
              <Inbox className="h-10 w-10 text-slate-200" />
              <p className="text-sm font-semibold text-slate-500">Nothing here</p>
              <p className="text-xs">You have no {status === 'ALL' ? '' : status.toLowerCase() + ' '}notifications.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {items.map((n) => {
                const s = severityStyle(n.severity);
                const isUnread = n.status === 'UNREAD';
                return (
                  <div key={n.id} className={`px-6 py-4 flex gap-3 group ${isUnread ? 'bg-red-50/30' : ''}`}>
                    <span className={`mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${isUnread ? s.dot : 'bg-slate-200'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm ${isUnread ? 'font-bold text-slate-800' : 'font-semibold text-slate-600'}`}>{n.title}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${s.chip}`}>{n.severity}</span>
                        {n.category && <span className="text-[9px] font-bold uppercase text-slate-400">{n.category}</span>}
                      </div>
                      {n.body && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{n.body}</p>}
                      <p className="text-[10px] text-slate-400 mt-1.5 font-mono">{relativeTime(n.createdAt)}</p>
                    </div>
                    {/* Per-item actions */}
                    <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isUnread && (
                        <button title="Mark read" onClick={() => markRead.mutate(n.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {n.status !== 'ARCHIVED' && (
                        <button title="Archive" onClick={() => archive.mutate(n.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button title="Delete" onClick={() => remove.mutate(n.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="ghost" size="sm" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}
            className="text-xs font-bold text-slate-500">
            <ChevronLeft className="h-4 w-4 mr-1" /> Prev
          </Button>
          <span className="text-xs text-slate-400 font-mono">Page {page + 1} of {totalPages}</span>
          <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}
            className="text-xs font-bold text-slate-500">
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
