import { useState, useEffect, useCallback } from 'react';
import { Bell, Check, Archive, Trash2, Loader2, AlertTriangle, Inbox, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  listHubNotifications, markHubNotificationRead, markAllHubNotificationsRead,
  archiveHubNotification, deleteHubNotification,
} from '../api/ksefApi';
import { useLanguage } from '../context/LanguageContext';

// ── KSeFFlow Notification Center ──────────────────────────────────────────────
// Same behaviour as the RegulaOne Notification Hub center: it reads the user's
// notifications straight from the Hub API (NOT mock data), filters by status, and
// supports per-item mark-read / archive / delete + mark-all-read, with pagination.
// Scoped to KSeFFlow (the API layer always sends module=KSEFFLOW).

const STATUS_TABS = ['ALL', 'UNREAD', 'READ', 'ARCHIVED'];

// Severity → colour, matching the KSeFFlow palette.
const SEV = {
  CRITICAL: { dot: 'bg-red-600',     chip: 'bg-red-50 text-red-700 border-red-200' },
  ERROR:    { dot: 'bg-rose-500',    chip: 'bg-rose-50 text-rose-700 border-rose-200' },
  WARNING:  { dot: 'bg-amber-500',   chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  SUCCESS:  { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  INFO:     { dot: 'bg-blue-500',    chip: 'bg-blue-50 text-blue-700 border-blue-200' },
};
const sev = (s) => SEV[s] ?? SEV.INFO;

const relTime = (iso) => {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
};

export default function NotificationCenter({ onChanged }) {
  const { language } = useLanguage();
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ content: [], totalPages: 0, totalElements: 0, number: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const T = (en, pl) => (language === 'pl' ? pl : en);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listHubNotifications({ status, page, size: 20 })
      .then(setData)
      .catch((e) => setError(e.message || T('Failed to load notifications', 'Nie udało się wczytać powiadomień.')))
      .finally(() => setLoading(false));
  }, [status, page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Run a mutation, then refresh this list + the header bell.
  const act = async (id, fn) => {
    setBusyId(id);
    try { await fn(); load(); onChanged?.(); }
    finally { setBusyId(null); }
  };

  const items = data.content ?? [];
  const totalPages = data.totalPages ?? 0;

  const tabLabel = (k) => ({
    ALL: T('All', 'Wszystkie'), UNREAD: T('Unread', 'Nieprzeczytane'),
    READ: T('Read', 'Przeczytane'), ARCHIVED: T('Archived', 'Zarchiwizowane'),
  }[k]);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 text-white rounded-xl p-2"><Bell size={18} /></div>
          <div>
            <h2 className="text-lg font-bold text-stone-800 tracking-tight">{T('Notifications', 'Powiadomienia')}</h2>
            <p className="text-xs text-stone-500">{data.totalElements} {T('total', 'łącznie')}</p>
          </div>
        </div>
        <button
          onClick={() => act(null, markAllHubNotificationsRead)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold border border-stone-300 hover:border-stone-400 hover:bg-stone-50 text-stone-700 rounded-lg px-3 py-2 transition cursor-pointer"
        >
          <Check size={13} /> {T('Mark all read', 'Oznacz wszystkie jako przeczytane')}
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl w-fit">
        {STATUS_TABS.map((k) => (
          <button
            key={k}
            onClick={() => { setStatus(k); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              status === k ? 'bg-white text-red-700 shadow-sm' : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            {tabLabel(k)}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white border border-stone-200/90 rounded-xl shadow-xs overflow-hidden">
        {error ? (
          <div className="px-6 py-10 flex flex-col items-center gap-2 text-rose-500">
            <AlertTriangle size={22} /><p className="text-sm font-medium">{error}</p>
          </div>
        ) : loading ? (
          <div className="px-6 py-16 flex justify-center"><Loader2 className="animate-spin text-stone-300" size={24} /></div>
        ) : items.length === 0 ? (
          <div className="px-6 py-16 flex flex-col items-center gap-2 text-stone-400">
            <Inbox size={36} className="text-stone-200" />
            <p className="text-sm font-semibold text-stone-500">{T('Nothing here', 'Brak powiadomień')}</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-50">
            {items.map((n) => {
              const s = sev(n.severity);
              const unread = n.status === 'UNREAD';
              const busy = busyId === n.id;
              return (
                <div key={n.id} className={`px-6 py-4 flex gap-3 group ${unread ? 'bg-red-50/30' : ''}`}>
                  <span className={`mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${unread ? s.dot : 'bg-stone-200'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm ${unread ? 'font-bold text-stone-800' : 'font-semibold text-stone-600'}`}>{n.title}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${s.chip}`}>{n.severity}</span>
                      {n.category && <span className="text-[9px] font-bold uppercase text-stone-400">{n.category}</span>}
                    </div>
                    {n.message && <p className="text-xs text-stone-500 mt-1 leading-relaxed">{n.message}</p>}
                    <p className="text-[10px] text-stone-400 mt-1.5 font-mono">{relTime(n.timestamp)}</p>
                  </div>
                  <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {busy ? <Loader2 size={14} className="animate-spin text-stone-300 mt-1" /> : (
                      <>
                        {unread && (
                          <button title={T('Mark read', 'Przeczytane')} onClick={() => act(n.id, () => markHubNotificationRead(n.id))}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-emerald-600 hover:bg-emerald-50"><Check size={14} /></button>
                        )}
                        {n.status !== 'ARCHIVED' && (
                          <button title={T('Archive', 'Archiwizuj')} onClick={() => act(n.id, () => archiveHubNotification(n.id))}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"><Archive size={14} /></button>
                        )}
                        <button title={T('Delete', 'Usuń')} onClick={() => act(n.id, () => deleteHubNotification(n.id))}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 size={14} /></button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button disabled={page <= 0} onClick={() => setPage((p) => p - 1)}
            className="inline-flex items-center gap-1 text-xs font-bold text-stone-500 disabled:opacity-40 cursor-pointer">
            <ChevronLeft size={16} /> {T('Prev', 'Wstecz')}
          </button>
          <span className="text-xs text-stone-400 font-mono">{T('Page', 'Strona')} {page + 1} / {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}
            className="inline-flex items-center gap-1 text-xs font-bold text-stone-500 disabled:opacity-40 cursor-pointer">
            {T('Next', 'Dalej')} <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
