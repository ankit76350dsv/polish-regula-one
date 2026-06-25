import { useState, useEffect, useCallback } from 'react';
import {
  Network, ShieldCheck, ShieldAlert, Power, RefreshCw, Loader2, Server, Info,
} from 'lucide-react';
import {
  getKsefStatus, getKsefConnection,
  declareKsefEmergency, declareKsefUnavailability, declareKsefOnline,
} from '../api/ksefApi';
import { useLanguage } from '../context/LanguageContext';
import { can } from '../lib/permissions';

// ── Government API Center ─────────────────────────────────────────────────────
// Shows the REAL state of the KSeF connection — nothing simulated:
//   1. KSeF operation mode (ONLINE / EMERGENCY / UNAVAILABILITY) from the backend, with the
//      admin controls to declare a state (these set the legal offline deadline).
//   2. The actual connection the backend uses (environment + base URL + invoice schema).
//   3. Recent KSeF-related activity, read from the immutable audit log.
// (Removed: fabricated request/response logs, fake latency, "simulate failure", and crypto
//  claims — none of that was real data.)

export default function IntegrationCenter({ permissions, onAddNotification }) {
  const { language, t } = useLanguage();
  const T = (en, pl) => (language === 'pl' ? pl : en);

  // Declaring states is KSEF_TENANT_ADMIN-only (matches the backend guards on /ksef-status/*).
  const isAdmin = can.manageAvailability(permissions);

  const [ksefStatus, setKsefStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const [connection, setConnection] = useState(null);

  const loadStatus = useCallback(() => {
    setStatusLoading(true);
    getKsefStatus().then(setKsefStatus).catch(() => {}).finally(() => setStatusLoading(false));
  }, []);

  const loadConnection = useCallback(() => {
    getKsefConnection().then(setConnection).catch(() => {});
  }, []);

  useEffect(() => { loadStatus(); loadConnection(); }, [loadStatus, loadConnection]);

  // Declare a state change; needs a reason for the audit trail.
  const runDeclare = async (action, label, needReason) => {
    let reason = `${label} (via Integration panel)`;
    if (needReason) {
      const input = window.prompt(t('integration.promptReason', { action: label }));
      if (input == null) return;
      if (!input.trim()) { onAddNotification(t('common.error'), t('integration.reasonRequired'), 'error'); return; }
      reason = input.trim();
    }
    setActionBusy(true);
    try {
      const status = await action(reason);
      setKsefStatus(status);
      onAddNotification(t('integration.statusUpdatedTitle'), t('integration.statusUpdatedDesc', { mode: status.mode }), 'info');
    } catch (err) {
      onAddNotification(t('integration.statusUpdateError'), err.message || T('Operation failed.', 'Operacja nie powiodła się.'), 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const mode = ksefStatus?.mode ?? 'UNKNOWN';
  const badge = mode === 'ONLINE'
    ? { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: t('integration.modeOnline') }
    : mode === 'EMERGENCY'
      ? { cls: 'bg-red-50 text-red-700 border-red-200', text: t('integration.modeEmergency') }
      : mode === 'OFFLINE_UNAVAILABILITY'
        ? { cls: 'bg-orange-50 text-orange-700 border-orange-200', text: t('integration.modeUnavailable') }
        : { cls: 'bg-slate-100 text-slate-500 border-slate-200', text: t('integration.modeUnknown') };

  const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString('pl-PL') : '—');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
          <Network className="text-red-700" size={20} />
          {t('integration.title')}
        </h2>
        <p className="text-zinc-500 text-xs mt-0.5">{t('integration.desc')}</p>
      </div>

      {/* ── KSeF operation mode (authoritative, from the backend) ──────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
              <ShieldCheck size={15} className="text-red-650" /> {t('integration.ksefModeHeader')}
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">{t('integration.ksefModeDesc')}</p>
          </div>
          <button
            onClick={loadStatus}
            disabled={statusLoading}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold py-1.5 px-3 rounded-lg text-[11px] transition cursor-pointer disabled:opacity-60"
          >
            {statusLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} {t('integration.refresh')}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.cls}`}>{badge.text}</span>
          {ksefStatus?.reason && <span className="text-slate-500">{t('integration.reasonLabel')} <strong className="text-slate-700">{ksefStatus.reason}</strong></span>}
          {ksefStatus?.declaredBy && <span className="text-slate-400">{t('integration.declaredByLabel')} <span className="font-mono">{ksefStatus.declaredBy}</span></span>}
          {ksefStatus?.since && <span className="text-slate-400">{t('integration.sinceLabel')} {fmtTime(ksefStatus.since)}</span>}
        </div>

        {isAdmin ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={() => runDeclare(declareKsefEmergency, t('integration.modeEmergency'), true)} disabled={actionBusy}
              className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 px-3 rounded-lg text-[11px] transition cursor-pointer disabled:opacity-60">
              <ShieldAlert size={13} /> {t('integration.btnDeclareEmergency')}
            </button>
            <button onClick={() => runDeclare(declareKsefUnavailability, t('integration.modeUnavailable'), true)} disabled={actionBusy}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-orange-50 border border-orange-200 text-orange-700 font-semibold py-1.5 px-3 rounded-lg text-[11px] transition cursor-pointer disabled:opacity-60">
              <Power size={13} /> {t('integration.btnDeclareUnavailable')}
            </button>
            <button onClick={() => runDeclare(declareKsefOnline, t('integration.modeOnline'), false)} disabled={actionBusy}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold py-1.5 px-3 rounded-lg text-[11px] transition cursor-pointer disabled:opacity-60">
              <ShieldCheck size={13} /> {t('integration.btnRestoreOnline')}
            </button>
            {actionBusy && <Loader2 size={14} className="animate-spin text-slate-400 self-center" />}
          </div>
        ) : (
          <p className="text-[11px] text-slate-400">{t('integration.adminOnlyWarning')}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Real connection config ───────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
            <Server size={15} className="text-red-650" /> {T('KSeF connection', 'Połączenie z KSeF')}
          </h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500 text-xs">{T('Environment', 'Środowisko')}</dt>
              <dd>
                {connection ? (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    connection.environment === 'PRODUCTION'
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {connection.environment === 'PRODUCTION' ? T('Production', 'Produkcja') : T('Test / Sandbox', 'Test / Piaskownica')}
                  </span>
                ) : <Loader2 size={13} className="animate-spin text-slate-300" />}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500 text-xs">{T('Endpoint', 'Adres API')}</dt>
              <dd className="font-mono text-xs text-slate-700 break-all text-right">{connection?.baseUrl ?? '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500 text-xs">{T('Invoice schema', 'Schemat faktury')}</dt>
              <dd className="font-mono text-xs text-slate-700">{connection?.invoiceSchema ?? '—'}</dd>
            </div>
          </dl>
          <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
            {T('Set by the server (not selectable here) so test invoices never reach the live system. Detailed activity and errors are recorded in the Audit Center.',
               'Ustawiane po stronie serwera (nie można go tu zmienić), aby faktury testowe nigdy nie trafiły do systemu produkcyjnego. Szczegółowa aktywność i błędy są zapisywane w Centrum Audytu.')}
          </p>
        </div>

        {/* ── Operation modes explainer (supports the Declare buttons above) ───── */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
            <Info size={15} className="text-red-650" /> {T('Operation modes', 'Tryby pracy')}
          </h3>
          <ul className="mt-4 space-y-3 text-xs">
            <li className="flex gap-2.5">
              <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
              <span><strong className="text-slate-700">{T('Online', 'Online')}</strong> — {T('KSeF is available; invoices are sent in real time.', 'KSeF jest dostępny; faktury są wysyłane na bieżąco.')}</span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1 h-2 w-2 rounded-full bg-orange-500 flex-shrink-0" />
              <span><strong className="text-slate-700">{T('Unavailability', 'Niedostępność')}</strong> — {T('KSeF is temporarily down (e.g. maintenance). Offline invoices must reach KSeF by the next business day.', 'KSeF jest chwilowo niedostępny (np. przerwa techniczna). Faktury offline muszą trafić do KSeF do następnego dnia roboczego.')}</span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1 h-2 w-2 rounded-full bg-red-500 flex-shrink-0" />
              <span><strong className="text-slate-700">{T('Emergency', 'Tryb awaryjny')}</strong> — {T('Declared only on an official Ministry of Finance announcement; the window extends to 7 business days.', 'Ogłaszany wyłącznie na podstawie oficjalnego komunikatu Ministerstwa Finansów; termin wydłuża się do 7 dni roboczych.')}</span>
            </li>
          </ul>
          <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
            {T('Declaring a state changes the legal deadline by which offline invoices must be transmitted to KSeF.',
               'Ogłoszenie trybu zmienia ustawowy termin, w którym faktury offline muszą zostać przesłane do KSeF.')}
          </p>
        </div>
      </div>
    </div>
  );
}
