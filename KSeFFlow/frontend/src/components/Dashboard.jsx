import { useState, useEffect, useCallback } from 'react';
import {
  FileCheck2, AlertTriangle, ShieldCheck, TrendingUp, Activity, RefreshCw,
  Loader2, ArrowUpRight, ArrowRight, Inbox, Wallet, FileText, KeyRound, Network,
  LayoutDashboard,
} from 'lucide-react';
import { getDashboardSummary } from '../api/ksefApi';
import { useLanguage } from '../context/LanguageContext';
import { can } from '../lib/permissions';

// ── Dashboard ─────────────────────────────────────────────────────────────────
// Single source of truth: GET /api/v1/dashboard/summary. Every figure is REAL (server-computed
// from the tenant's own data). No mock charts, no fake latency, no invented exchange rate.

// Visual meta per invoice status (label + colour) — used by the distribution bar and recent list.
const STATUS_META = {
  SENT:         { en: 'Sent',            pl: 'Wysłane',     bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PENDING:      { en: 'Pending',         pl: 'Oczekujące',  bar: 'bg-blue-500',    chip: 'bg-blue-50 text-blue-700 border-blue-200' },
  OFFLINE_MODE: { en: 'Queued (offline)',pl: 'Offline',     bar: 'bg-orange-500',  chip: 'bg-orange-50 text-orange-700 border-orange-200' },
  RETRYING:     { en: 'Retrying',        pl: 'Ponawiane',   bar: 'bg-amber-500',   chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  FAILED:       { en: 'Not sent',        pl: 'Niewysłane',  bar: 'bg-red-500',     chip: 'bg-red-50 text-red-700 border-red-200' },
  DRAFT:        { en: 'Draft',           pl: 'Robocze',     bar: 'bg-slate-300',   chip: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export default function Dashboard({ tenant, role, permissions, onNavigate, onOpenInvoice }) {
  const { t, language } = useLanguage();
  const T = (en, pl) => (language === 'pl' ? pl : en);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getDashboardSummary()
      .then(setData)
      .catch((err) => setError(err?.message || T('Could not load the dashboard.', 'Nie udało się wczytać pulpitu.')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const money = (amount, currency) =>
    new Intl.NumberFormat('pl-PL', { style: 'currency', currency: currency || 'PLN', maximumFractionDigits: 0 }).format(Number(amount) || 0);
  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const statusLabel = (s) => (STATUS_META[s] ? T(STATUS_META[s].en, STATUS_META[s].pl) : s);

  // ── Header (always shown) — matches the app's page-header pattern ────────────
  const header = (
    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-200 pb-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <LayoutDashboard className="text-red-600" size={20} />
          {t('dashboard.title')}
        </h2>
        <p className="text-slate-400 text-xs mt-1 flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-slate-600">{tenant?.name}</span>
          <span className="text-slate-300">·</span>
          {t('sidebar.nip')}: <strong className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-bold">{tenant?.nip}</strong>
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-xs text-center">
          <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">{t('dashboard.role')}</div>
          <div className="text-xs font-bold text-slate-700 mt-0.5">{role}</div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold py-2 px-3 rounded-xl text-xs transition cursor-pointer disabled:opacity-60"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} {T('Refresh', 'Odśwież')}
        </button>
      </div>
    </div>
  );

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="space-y-6">
        {header}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
              <div className="h-7 w-28 bg-slate-100 rounded mt-3 animate-pulse" />
              <div className="h-3 w-20 bg-slate-100 rounded mt-3 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-xs h-64 animate-pulse" />
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs h-64 animate-pulse" />
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-6">
        {header}
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center space-y-3">
          <AlertTriangle className="mx-auto text-red-400" size={28} />
          <p className="text-sm font-semibold text-red-700">{T('Could not load the dashboard', 'Nie udało się wczytać pulpitu')}</p>
          <p className="text-xs text-red-500">{error}</p>
          <button onClick={load} className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg text-xs transition cursor-pointer">
            <RefreshCw size={13} /> {T('Try again', 'Spróbuj ponownie')}
          </button>
        </div>
      </div>
    );
  }

  const c = data?.invoices ?? { total: 0, draft: 0, pending: 0, sent: 0, offline: 0, retrying: 0, failed: 0 };
  const totals = data?.totals ?? [];
  const primary = totals.find((x) => x.currency === 'PLN') ?? totals[0] ?? null;
  const certs = data?.certificates ?? { active: 0, expiringSoon: 0, nearestExpiry: null, hasAuthentication: false, hasOffline: false };
  const ksef = data?.ksef ?? { mode: 'ONLINE', environment: 'SANDBOX' };
  const recent = data?.recent ?? [];
  const canIssue = can.issueInvoices(permissions);

  // ── Empty state (no invoices yet) ───────────────────────────────────────────
  if (c.total === 0) {
    return (
      <div className="space-y-6">
        {header}
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-4 shadow-xs">
          <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center"><Inbox className="text-red-600" size={26} /></div>
          <div>
            <h3 className="text-base font-bold text-slate-800">{T('No invoices yet', 'Brak faktur')}</h3>
            <p className="text-sm text-slate-500 mt-1">{T('Issue your first KSeF invoice to see your dashboard come to life.', 'Wystaw pierwszą fakturę KSeF, aby zobaczyć dane na pulpicie.')}</p>
          </div>
          {canIssue && (
            <button onClick={() => onNavigate('create')} className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition cursor-pointer">
              <FileText size={15} /> {T('Issue an invoice', 'Wystaw fakturę')}
            </button>
          )}
        </div>
        <KsefAndCertStrip ksef={ksef} certs={certs} onNavigate={onNavigate} T={T} fmtDate={fmtDate} />
      </div>
    );
  }

  // ── Metric cards ──────────────────────────────────────────────────────────────
  const card = (label, value, sub, icon, accent = 'red') => (
    <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-all shadow-xs flex items-start justify-between">
      <div className="space-y-2 min-w-0">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest block">{label}</span>
        <div className="text-2xl font-semibold text-slate-800 tracking-tight truncate">{value}</div>
        <div className="text-xs text-slate-500">{sub}</div>
      </div>
      <div className={`p-2.5 rounded-lg shrink-0 ${accent === 'orange' ? 'bg-orange-50 text-orange-600' : accent === 'slate' ? 'bg-slate-50 text-slate-600 border border-slate-100' : 'bg-red-50 text-red-600'}`}>
        {icon}
      </div>
    </div>
  );

  // Status distribution segments (only non-zero), built from real counts.
  const segments = [
    ['SENT', c.sent], ['PENDING', c.pending], ['OFFLINE_MODE', c.offline],
    ['RETRYING', c.retrying], ['FAILED', c.failed], ['DRAFT', c.draft],
  ].filter(([, n]) => n > 0);
  const segTotal = segments.reduce((s, [, n]) => s + n, 0) || 1;

  return (
    <div className="space-y-6">
      {header}

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {card(
          T('Issued value', 'Wartość wystawiona'),
          primary ? money(primary.gross, primary.currency) : money(0, 'PLN'),
          primary
            ? <span className="text-emerald-600 font-semibold">{T('Net', 'Netto')}: {money(primary.net, primary.currency)}{totals.length > 1 ? ` · +${totals.length - 1} ${T('more currencies', 'inne waluty')}` : ''}</span>
            : T('No issued invoices yet', 'Brak wystawionych faktur'),
          <Wallet size={18} />,
        )}
        {card(
          T('Sent / Drafts', 'Wysłane / Robocze'),
          <span>{c.sent} <span className="text-slate-300 font-light text-xl">/</span> {c.draft}</span>,
          <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />{c.sent} {T('accepted by KSeF', 'przyjęte przez KSeF')}</span>,
          <FileCheck2 size={18} />,
        )}
        {card(
          T('Acceptance rate', 'Skuteczność'),
          `${data?.successRate ?? 0}%`,
          <span className="flex items-center gap-1"><Activity size={12} className="text-emerald-500" />{T('of submitted invoices', 'wysłanych faktur')}</span>,
          <ShieldCheck size={18} />,
        )}
        {card(
          T('Needs attention', 'Wymaga uwagi'),
          data?.needsAttention ?? 0,
          (data?.needsAttention ?? 0) > 0
            ? <span className="text-orange-600 font-medium flex items-center gap-1"><AlertTriangle size={12} />{T('offline / retrying / failed', 'offline / ponawiane / błędy')}</span>
            : <span className="text-emerald-600">{T('All clear', 'Wszystko w porządku')}</span>,
          <TrendingUp size={18} />,
          (data?.needsAttention ?? 0) > 0 ? 'orange' : 'slate',
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: status distribution + recent activity */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
            <h3 className="font-semibold text-sm text-slate-800 mb-4">{T('Invoice status', 'Status faktur')}</h3>
            <div className="flex w-full h-3 rounded-full overflow-hidden bg-slate-100">
              {segments.map(([s, n]) => (
                <div key={s} className={STATUS_META[s].bar} style={{ width: `${(n / segTotal) * 100}%` }} title={`${statusLabel(s)}: ${n}`} />
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 mt-4">
              {segments.map(([s, n]) => (
                <div key={s} className="flex items-center gap-2 text-xs">
                  <span className={`inline-block w-2.5 h-2.5 rounded-sm ${STATUS_META[s].bar}`} />
                  <span className="text-slate-500">{statusLabel(s)}</span>
                  <span className="ml-auto font-semibold text-slate-700">{n}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-sm text-slate-800">{T('Recent activity', 'Ostatnia aktywność')}</h3>
              <button onClick={() => onNavigate('invoices')} className="text-red-600 font-semibold text-xs hover:text-red-700 flex items-center gap-1 cursor-pointer">
                {T('View all', 'Zobacz wszystkie')} <ArrowRight size={13} />
              </button>
            </div>
            {recent.length === 0 ? (
              <div className="px-6 py-10 text-center text-xs text-slate-400">{T('No recent invoices.', 'Brak ostatnich faktur.')}</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recent.map((inv) => (
                  <li key={inv.id}>
                    <button
                      onClick={() => onOpenInvoice?.(inv.id)}
                      className="w-full flex items-center gap-3 px-6 py-3 hover:bg-slate-50/70 transition text-left cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-mono font-semibold text-xs text-slate-800 truncate">{inv.invoiceNumber}</p>
                        <p className="text-[11px] text-slate-400 truncate">{inv.buyerName || '—'} · {fmtDate(inv.createdAt)}</p>
                      </div>
                      <span className="font-mono text-xs text-slate-700 shrink-0">{money(inv.totalGross, inv.currency)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0 ${STATUS_META[inv.status]?.chip ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {inv.statusLabel || statusLabel(inv.status)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: KSeF status + certificate health */}
        <div className="space-y-6">
          <KsefAndCertStrip ksef={ksef} certs={certs} onNavigate={onNavigate} T={T} fmtDate={fmtDate} />
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <h4 className="font-semibold text-slate-800 text-sm mb-4">{T('Quick actions', 'Szybkie akcje')}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {canIssue && (
            <QuickAction n="01" title={T('Issue an invoice', 'Wystaw fakturę')} desc={T('Create and send an FA(3) invoice to KSeF.', 'Utwórz i wyślij fakturę FA(3) do KSeF.')} onClick={() => onNavigate('create')} />
          )}
          <QuickAction n={canIssue ? '02' : '01'} title={T('Track invoices', 'Śledź faktury')} desc={T('Browse and check the status of your invoices.', 'Przeglądaj i sprawdzaj status faktur.')} onClick={() => onNavigate('invoices')} />
          <QuickAction n={canIssue ? '03' : '02'} title={T('Certificates', 'Certyfikaty')} desc={T('Manage the KSeF certificates used to sign invoices.', 'Zarządzaj certyfikatami KSeF do podpisywania faktur.')} onClick={() => onNavigate('certificates')} />
        </div>
      </div>
    </div>
  );
}

// Quick-action tile.
function QuickAction({ n, title, desc, onClick }) {
  return (
    <div onClick={onClick} className="border border-slate-200 p-4 rounded-xl cursor-pointer hover:border-red-400 hover:bg-slate-50 hover:shadow-xs transition flex items-center gap-3">
      <div className="bg-red-50 text-red-600 p-2 rounded-lg font-bold text-xs">{n}</div>
      <div>
        <p className="font-semibold text-sm text-slate-700">{title}</p>
        <p className="text-slate-400 text-xs">{desc}</p>
      </div>
    </div>
  );
}

// KSeF status + certificate health side panel (reused in the empty state too).
function KsefAndCertStrip({ ksef, certs, onNavigate, T, fmtDate }) {
  const modeMeta = ksef.mode === 'ONLINE'
    ? { label: T('Online', 'Online'), cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' }
    : ksef.mode === 'EMERGENCY'
      ? { label: T('Emergency', 'Tryb awaryjny'), cls: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' }
      : { label: T('Unavailable', 'Niedostępny'), cls: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' };
  const env = ksef.environment === 'PRODUCTION' ? T('Production', 'Produkcja') : T('Test / Sandbox', 'Test / Piaskownica');

  return (
    <>
      {/* KSeF status */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
          <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-2"><Network size={15} className="text-red-600" />{T('KSeF connection', 'Połączenie z KSeF')}</h4>
          <button onClick={() => onNavigate('integration')} className="text-red-600 hover:text-red-700 text-xs font-semibold flex items-center gap-1 cursor-pointer">{T('Details', 'Szczegóły')} <ArrowUpRight size={13} /></button>
        </div>
        <div className="space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">{T('Status', 'Status')}</span>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${modeMeta.cls}`}><span className={`w-2 h-2 rounded-full ${modeMeta.dot}`} />{modeMeta.label}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">{T('Environment', 'Środowisko')}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ksef.environment === 'PRODUCTION' ? 'bg-stone-900 text-white border-stone-900' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{env}</span>
          </div>
        </div>
      </div>

      {/* Certificate health — compliance critical */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
          <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-2"><KeyRound size={15} className="text-red-600" />{T('Certificates', 'Certyfikaty')}</h4>
          <button onClick={() => onNavigate('certificates')} className="text-red-600 hover:text-red-700 text-xs font-semibold flex items-center gap-1 cursor-pointer">{T('Manage', 'Zarządzaj')} <ArrowUpRight size={13} /></button>
        </div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-2xl font-semibold text-slate-800">{certs.active}</span>
          <span className="text-xs text-slate-500">{T('active certificate(s)', 'aktywne certyfikaty')}</span>
        </div>
        <div className="space-y-2 text-[11px]">
          {!certs.hasAuthentication && (
            <p className="flex items-start gap-1.5 text-red-700 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{T('No authentication certificate — you cannot connect to KSeF.', 'Brak certyfikatu uwierzytelniającego — nie można połączyć się z KSeF.')}</p>
          )}
          {!certs.hasOffline && (
            <p className="flex items-start gap-1.5 text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{T('No offline certificate — offline invoices cannot be sealed.', 'Brak certyfikatu offline — faktur offline nie można opieczętować.')}</p>
          )}
          {certs.expiringSoon > 0 && (
            <p className="flex items-start gap-1.5 text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{T(`${certs.expiringSoon} expiring within 30 days`, `${certs.expiringSoon} wygasa w ciągu 30 dni`)}{certs.nearestExpiry ? ` (${fmtDate(certs.nearestExpiry)})` : ''}</p>
          )}
          {certs.hasAuthentication && certs.hasOffline && certs.expiringSoon === 0 && (
            <p className="flex items-center gap-1.5 text-emerald-700"><ShieldCheck size={13} />{T('All required certificates are active.', 'Wszystkie wymagane certyfikaty są aktywne.')}</p>
          )}
        </div>
      </div>
    </>
  );
}
