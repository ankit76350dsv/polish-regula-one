import { useState } from 'react';
import { Workflow, RefreshCw, CheckCircle, Zap, Loader2, Info } from 'lucide-react';
import OfflineComplianceCard from './OfflineComplianceCard';
import { retryOfflineInvoice } from '../api/ksefApi';
import { can } from '../lib/permissions';
import { useLanguage } from '../context/LanguageContext';

// ── Offline Queue ─────────────────────────────────────────────────────────────
// Shows the REAL invoices parked offline (status OFFLINE_MODE / RETRYING), fetched from the
// KSeFFlow backend. A background job on the server (KsefRetryQueueService) retries them
// automatically with exponential backoff until the legal deadline; the buttons here let a
// user trigger that same retry NOW via POST /api/v1/invoices/{id}/retry — a genuine call to
// KSeF, not a simulation. There is NO RabbitMQ; the queue is the set of OFFLINE_MODE invoices.
export default function OfflineQueue({ tenant, role, permissions, invoices, isLoading, onRefreshInvoices, onAddNotification }) {
  const { language, t } = useLanguage();
  const canModify = can.issueInvoices(permissions);

  // Real queue = this tenant's invoices currently parked offline or mid-retry.
  const offlineInvoices = invoices.filter(
    (inv) => inv.tenantId === tenant.id && (inv.status === 'OFFLINE_MODE' || inv.status === 'RETRYING'),
  );

  // The soonest upcoming automatic retry across the queue (ISO strings sort chronologically).
  const soonestNextRetry = offlineInvoices
    .map((inv) => inv.nextRetryAt)
    .filter(Boolean)
    .sort()[0] || null;

  const [retryingId, setRetryingId] = useState(null); // single invoice in flight
  const [bulkRetrying, setBulkRetrying] = useState(false);

  const T = (en, pl) => (language === 'pl' ? pl : en);

  // Formats the backend-computed next automatic-retry time as "20/05, 14:32 · in ~5m"
  // (or "· due now (next cycle)" when it's already eligible).
  const formatNextRetry = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const time = d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
    const diffMin = Math.round((d.getTime() - Date.now()) / 60000);
    if (diffMin <= 0) return `${time} · ${T('due now (next cycle)', 'teraz (następny cykl)')}`;
    const rel = diffMin < 60
      ? T(`in ~${diffMin}m`, `za ~${diffMin} min`)
      : T(`in ~${Math.round(diffMin / 60)}h`, `za ~${Math.round(diffMin / 60)} godz.`);
    return `${time} · ${rel}`;
  };

  const notifyOutcome = (inv, result) => {
    if (result.status === 'SENT') {
      onAddNotification(
        T('Sent to KSeF', 'Wysłano do KSeF'),
        T(`Invoice ${inv.invoiceNumber} was accepted by KSeF (ksefId ${result.ksefId}).`,
          `Faktura ${inv.invoiceNumber} została zaakceptowana przez KSeF (ksefId ${result.ksefId}).`),
        'success',
      );
    } else {
      onAddNotification(
        T('Still queued', 'Nadal w kolejce'),
        T(`Invoice ${inv.invoiceNumber} could not be sent yet: ${result.lastErrorMessage || 'KSeF unavailable'}.`,
          `Faktury ${inv.invoiceNumber} nie udało się jeszcze wysłać: ${result.lastErrorMessage || 'KSeF niedostępny'}.`),
        'warn',
      );
    }
  };

  // Retry ONE invoice against the real KSeF gateway, then refresh the list.
  const handleRetry = async (inv) => {
    if (!canModify || retryingId || bulkRetrying) return;
    setRetryingId(inv.id);
    try {
      const result = await retryOfflineInvoice(inv.id);
      notifyOutcome(inv, result);
    } catch (e) {
      onAddNotification(T('Retry failed', 'Ponowienie nie powiodło się'), e.message || 'Error', 'error');
    } finally {
      setRetryingId(null);
      onRefreshInvoices?.();
    }
  };

  // Retry every queued invoice sequentially (each is a real submission attempt).
  const handleRetryAll = async () => {
    if (!canModify || offlineInvoices.length === 0 || bulkRetrying) return;
    setBulkRetrying(true);
    let sent = 0;
    try {
      for (const inv of offlineInvoices) {
        try {
          const result = await retryOfflineInvoice(inv.id);
          if (result.status === 'SENT') sent += 1;
        } catch { /* keep going; one bad invoice shouldn't stop the rest */ }
      }
      onAddNotification(
        T('Retry round complete', 'Zakończono ponawianie'),
        T(`${sent} of ${offlineInvoices.length} invoice(s) were accepted by KSeF. The rest remain queued.`,
          `${sent} z ${offlineInvoices.length} faktur zostało zaakceptowanych przez KSeF. Pozostałe nadal w kolejce.`),
        sent > 0 ? 'success' : 'warn',
      );
    } finally {
      setBulkRetrying(false);
      onRefreshInvoices?.();
    }
  };

  const busy = bulkRetrying || retryingId !== null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
          <Workflow className="text-red-700" size={20} />
          {t('offline.title')}
        </h2>
        <p className="text-zinc-550 text-xs mt-0.5">{t('offline.desc')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: queue summary + actions */}
        <div className="lg:col-span-5 bg-white border border-stone-200/90 rounded-xl p-5 shadow-xs space-y-5">
          <div className="border-b pb-3 border-stone-100">
            <h4 className="font-semibold text-stone-850 text-xs uppercase tracking-wider">{t('offline.retryOrchestration')}</h4>
            <p className="text-stone-500 text-[11px]">{t('offline.legalNotice')}</p>
          </div>

          <div className="space-y-4">
            <div className="bg-stone-50 border p-5 rounded-xl text-center space-y-2">
              <div className="text-[10px] text-stone-400 uppercase font-bold tracking-widest">
                {T('Invoices awaiting KSeF', 'Faktury oczekujące na KSeF')}
              </div>
              <div className="text-3xl font-extrabold text-stone-850">
                {isLoading ? <Loader2 className="inline animate-spin text-stone-300" size={22} /> : offlineInvoices.length}
                {!isLoading && <span className="text-xs font-normal text-stone-500"> {t('offline.documentsSuffix')}</span>}
              </div>

              {offlineInvoices.length > 0 ? (
                <>
                  {soonestNextRetry && (
                    <div className="mt-2 bg-white border border-red-100 rounded-lg px-3 py-2 text-left">
                      <div className="text-[9px] text-stone-400 uppercase font-bold tracking-widest flex items-center gap-1">
                        <RefreshCw size={10} className="text-red-600" />
                        {T('Next automatic retry', 'Następne automatyczne ponowienie')}
                      </div>
                      <div className="text-sm font-bold font-mono text-stone-850 mt-0.5">{formatNextRetry(soonestNextRetry)}</div>
                    </div>
                  )}
                  <p className="text-[10.5px] text-stone-600 leading-normal bg-white p-2.5 rounded-lg border border-stone-100 mt-2">
                    {T('A background job retries these automatically with backoff until the legal deadline. You can also retry now.',
                       'Zadanie w tle ponawia je automatycznie aż do ustawowego terminu. Możesz też ponowić teraz.')}
                  </p>
                </>
              ) : (
                <div className="text-xs text-stone-400 py-3">
                  {T('No invoices are queued offline.', 'Brak faktur w kolejce offline.')}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <button
                onClick={handleRetryAll}
                disabled={busy || offlineInvoices.length === 0 || !canModify}
                className="w-full bg-red-700 hover:bg-red-800 disabled:opacity-50 text-stone-100 font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                {bulkRetrying ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {T('Retry all now', 'Ponów wszystkie teraz')}
              </button>
              {!canModify && (
                <p className="text-[10px] text-center text-zinc-550 leading-snug">
                  {T('Your role cannot submit invoices to KSeF.', 'Twoja rola nie może wysyłać faktur do KSeF.')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: the real offline invoices */}
        <div className="lg:col-span-7 bg-white border border-stone-200/90 rounded-xl p-5 shadow-xs space-y-4">
          <div className="border-b pb-3 border-stone-100 flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-stone-850 text-xs uppercase tracking-wider">{t('offline.transactionsHeader')}</h4>
              <p className="text-stone-500 text-xs">{t('offline.transactionsDesc')}</p>
            </div>
            <button
              onClick={() => onRefreshInvoices?.()}
              className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-50 transition"
              title={T('Refresh', 'Odśwież')}
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
            {offlineInvoices.map((inv) => (
              <div key={inv.id} className="border border-stone-200 p-4 rounded-xl hover:bg-stone-50/50 transition text-xs space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-mono font-bold text-stone-900 text-sm">{inv.invoiceNumber}</h5>
                    <p className="text-stone-505 mt-0.5 font-semibold text-[11px]">{inv.buyerName}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                    inv.status === 'RETRYING' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-850 border-amber-200'
                  }`}>
                    {inv.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10.5px] text-stone-605 font-mono">
                  <div>
                    <span className="text-stone-400 block font-normal font-sans text-[9px] uppercase">{t('offline.nipCode')}</span>
                    <strong>{inv.buyerNIP}</strong>
                  </div>
                  <div>
                    <span className="text-stone-400 block font-normal font-sans text-[9px] uppercase">{t('offline.preTaxSum')}</span>
                    <strong>{inv.totalNet.toLocaleString()} {inv.currency}</strong>
                  </div>
                  <div>
                    <span className="text-stone-400 block font-normal font-sans text-[9px] uppercase">{t('offline.totalGross')}</span>
                    <strong className="text-stone-850">{inv.totalGross.toLocaleString()} {inv.currency}</strong>
                  </div>
                  <div>
                    <span className="text-stone-400 block font-normal font-sans text-[9px] uppercase">{t('offline.retryTokens')}</span>
                    <strong className="text-orange-707 font-bold font-mono">{inv.submissionAttempts} {t('offline.attempts')}</strong>
                  </div>
                </div>

                {inv.nextRetryAt && (
                  <p className="text-[11px] text-stone-700 flex items-center gap-1.5 bg-stone-50 border border-stone-100 rounded-lg px-2.5 py-1.5">
                    <RefreshCw size={12} className="text-red-600" />
                    {T('Next automatic retry', 'Następne automatyczne ponowienie')}:{' '}
                    <strong className="font-mono">{formatNextRetry(inv.nextRetryAt)}</strong>
                  </p>
                )}

                {inv.ksefSubmissionDeadline && (
                  <p className="text-[10px] text-stone-500 flex items-center gap-1">
                    <Info size={11} />
                    {T('Must reach KSeF by', 'Musi dotrzeć do KSeF do')} <strong className="font-mono">{String(inv.ksefSubmissionDeadline).replace('T', ' ').slice(0, 16)}</strong>
                  </p>
                )}

                {inv.lastErrorMessage && (
                  <div className="bg-red-50 border border-red-100 p-2.5 rounded-lg text-[10.5px] font-mono text-red-808 leading-normal whitespace-pre-wrap break-all">
                    {t('offline.logError', { error: inv.lastErrorMessage })}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <OfflineComplianceCard invoice={inv} onAddNotification={onAddNotification} />
                  <button
                    onClick={() => handleRetry(inv)}
                    disabled={!canModify || busy}
                    className="shrink-0 inline-flex items-center gap-1.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white font-semibold py-1.5 px-3 rounded-lg text-[11px] transition cursor-pointer"
                  >
                    {retryingId === inv.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    {T('Retry now', 'Ponów teraz')}
                  </button>
                </div>
              </div>
            ))}

            {offlineInvoices.length === 0 && !isLoading && (
              <div className="text-center py-16 text-zinc-400 flex flex-col justify-center items-center h-48">
                <CheckCircle size={32} className="text-emerald-505 mb-2" />
                <p>{T('Offline queue is clear — all invoices have reached KSeF.',
                      'Kolejka offline jest pusta — wszystkie faktury dotarły do KSeF.')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
