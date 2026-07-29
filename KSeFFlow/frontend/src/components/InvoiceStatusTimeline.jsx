import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, ArrowRight, Clock } from 'lucide-react';
import { getInvoiceStatus } from '../api/ksefApi';
import { useLanguage } from '../context/LanguageContext';

// ── Invoice status timeline ───────────────────────────────────────────────────
// SIMPLE EXPLANATION:
// Shows where an invoice is RIGHT NOW (e.g. "Sent"), tells the user WHAT TO DO NEXT,
// and lists the FULL history of how it got there — DRAFT → PENDING → SENT → ... —
// each step with its own timestamp. It reads everything from the backend status
// endpoint (GET /api/v1/invoices/{id}/status), so the labels and the "next step"
// text stay in sync with the server (single source of truth).

// Per-status colours — mirror the badge styling already used on the invoice header.
const STATUS_STYLES = {
  SENT:         { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  OFFLINE_MODE: { dot: 'bg-orange-500',  chip: 'bg-orange-50 text-orange-700 border-orange-200' },
  FAILED:       { dot: 'bg-red-500',     chip: 'bg-red-50 text-red-700 border-red-200' },
  RETRYING:     { dot: 'bg-amber-500',   chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  PENDING:      { dot: 'bg-blue-500',    chip: 'bg-blue-50 text-blue-700 border-blue-200' },
  DRAFT:        { dot: 'bg-slate-400',   chip: 'bg-slate-100 text-slate-600 border-slate-200' },
};
const styleFor = (status) => STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT;

// Format the backend LocalDateTime string ("2026-05-20T09:05:12") for display.
const fmt = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return Number.isNaN(d.getTime())
    ? String(ts)
    : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

export default function InvoiceStatusTimeline({ invoiceId }) {
  const { language } = useLanguage();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!invoiceId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getInvoiceStatus(invoiceId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load status history'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [invoiceId]);

  const T = {
    title:     language === 'pl' ? 'Historia statusu' : 'Status history',
    current:   language === 'pl' ? 'Aktualny status' : 'Current status',
    nextStep:  language === 'pl' ? 'Następny krok'    : 'Next step',
    by:        language === 'pl' ? 'przez'            : 'by',
    empty:     language === 'pl' ? 'Brak historii statusu.' : 'No status history yet.',
  };

  if (loading) {
    return (
      <div className="bg-white border border-stone-200/90 rounded-xl p-5 flex items-center gap-2 text-xs text-stone-400">
        <Loader2 size={14} className="animate-spin" /> {language === 'pl' ? 'Ładowanie…' : 'Loading…'}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700 flex items-center gap-2">
        <AlertCircle size={14} /> {error}
      </div>
    );
  }

  if (!data) return null;

  const cur = styleFor(data.currentStatus);
  // Show newest first in the timeline (most recent change at the top).
  const history = [...(data.history ?? [])].reverse();

  return (
    <div className="bg-white border border-stone-200/90 rounded-xl shadow-xs overflow-hidden">

      {/* Current status + next step */}
      <div className="p-5 border-b border-stone-100 space-y-3">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">{T.current}</span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${cur.chip}`}>
            ● {data.currentStatusLabel ?? data.currentStatus}
          </span>
        </div>

        {data.nextStep && (
          <div className="flex items-start gap-2 bg-stone-50 border border-stone-200/70 rounded-lg p-3">
            <ArrowRight size={14} className="text-red-700 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">{T.nextStep}</p>
              <p className="text-xs text-stone-700 leading-relaxed mt-0.5">{data.nextStep}</p>
            </div>
          </div>
        )}

        {/* Raw technical errors are intentionally NOT shown to users — the friendly "next step"
            above already explains what is happening. Detailed errors live in the Audit Center. */}
      </div>

      {/* History timeline */}
      <div className="p-5">
        <div className="flex items-center gap-1.5 mb-4">
          <Clock size={13} className="text-stone-400" />
          <h4 className="text-xs font-bold text-stone-700">{T.title}</h4>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-stone-400 italic">{T.empty}</p>
        ) : (
          <ol className="relative border-l border-stone-200 ml-1.5 space-y-5">
            {history.map((entry, idx) => {
              const s = styleFor(entry.status);
              return (
                <li key={`${entry.status}-${entry.timestamp}-${idx}`} className="ml-4">
                  <span className={`absolute -left-[5px] mt-1 w-2.5 h-2.5 rounded-full ring-2 ring-white ${s.dot}`} />
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${s.chip}`}>
                      {entry.statusLabel ?? entry.status}
                    </span>
                    <span className="text-[10px] text-stone-400 font-mono">{fmt(entry.timestamp)}</span>
                  </div>
                  {entry.note && <p className="text-[11px] text-stone-600 mt-1 leading-snug">{entry.note}</p>}
                  {entry.changedBy && (
                    <p className="text-[10px] text-stone-400 mt-0.5">
                      {T.by} {/system/i.test(entry.changedBy)
                        ? (language === 'pl' ? 'System (automatycznie)' : 'System (automatic)')
                        : entry.changedBy}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
