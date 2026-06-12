import { useState, useEffect } from 'react';
import {
  Workflow,
  RefreshCw,
  CheckCircle,
  Zap
} from 'lucide-react';
import OfflineComplianceCard from './OfflineComplianceCard';
import { useLanguage } from '../context/LanguageContext';

export default function OfflineQueue({ tenant, role, invoices, govStatus, onSetGovStatus, onProcessOfflineItem, onAddNotification }) {
  const { language, t } = useLanguage();
  const canModify = role === 'Super Admin' || role === 'Company Admin' || role === 'Accountant' || role === 'Finance User';
  const offlineInvoices = invoices.filter(inv => inv.tenantId === tenant.id && inv.status === 'OFFLINE_MODE');

  const [secondsLeft, setSecondsLeft] = useState(30);
  const [isProcessingCollection, setIsProcessingCollection] = useState(false);

  useEffect(() => {
    if (offlineInvoices.length === 0) {
      setSecondsLeft(30);
      return;
    }

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          triggerAutomatedFlush();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [offlineInvoices.length, govStatus]);

  const triggerAutomatedFlush = () => {
    if (offlineInvoices.length === 0) return;

    if (govStatus === 'Connected') {
      setIsProcessingCollection(true);
      setTimeout(() => {
        offlineInvoices.forEach(inv => {
          const generatedKsefId = `${inv.sellerNIP}-${new Date().toISOString().slice(0,10).replace(/[^0-9]/g, '')}-EF8A9B48102`;
          onProcessOfflineItem(inv.id, true, generatedKsefId);
        });
        setIsProcessingCollection(false);
        onAddNotification(
          language === 'pl' ? 'Wyczyszczenie kolejki powiodło się' : 'Queue Flush Success',
          language === 'pl'
            ? `RabbitMQ przetworzył ${offlineInvoices.length} faktur. Zakończono bezpieczny uścisk dłoni i wygenerowano certyfikaty UPO w publicznym KSeF.`
            : `RabbitMQ processed ${offlineInvoices.length} invoices. Secure handshake completed and UPO certificates generated on public KSeF.`,
          'success'
        );
      }, 1500);
    } else {
      offlineInvoices.forEach(inv => {
        onProcessOfflineItem(inv.id, false);
      });
      onAddNotification(
        language === 'pl' ? 'Ponowiono czyszczenie kolejki (Błąd)' : 'Queue Flush Retried (Failed)',
        language === 'pl'
          ? `Automatyczny demon synchronizacji wykonał 10-sekundową pętlę. Rządowe API KSeF nieosiągalne. Zmniejszanie puli żetonów ponowień.`
          : `Automatic synchronization daemon executed 10-sec loop. Polish Gov APIs unreachable. Decrementing retry token pools.`,
        'error'
      );
    }
  };

  const triggerManualBypass = () => {
    if (!canModify) {
      onAddNotification(
        language === 'pl' ? 'Odmowa uprawnień RBAC' : 'RBAC Permission Denied',
        language === 'pl' ? 'Twoja rola nie może wywołać czyszczenia kolejki systemowej.' : 'Your active role cannot trigger system queue flushes.',
        'error'
      );
      return;
    }

    if (offlineInvoices.length === 0) {
      alert(language === 'pl' ? 'Brak faktur do wyczyszczenia w lokalnym magazynie awaryjnym.' : 'No invoices to flush inside local fallback storage.');
      return;
    }

    if (govStatus !== 'Connected') {
      onSetGovStatus('Connected');
    }

    setIsProcessingCollection(true);
    setTimeout(() => {
      offlineInvoices.forEach(inv => {
        const generatedKsefId = `${inv.sellerNIP}-${new Date().toISOString().slice(0,10).replace(/[^0-9]/g, '')}-MF8B29C520`;
        onProcessOfflineItem(inv.id, true, generatedKsefId);
      });
      setIsProcessingCollection(false);
      onAddNotification(
        language === 'pl' ? 'Ręczne czyszczenie kolejki zakończone' : 'Manual Queue Flush Complete',
        language === 'pl'
          ? `Pomyślnie podpisano i przesłano ${offlineInvoices.length} faktur do bramki testowej KSeF.`
          : `Successfully signed & flushed ${offlineInvoices.length} invoices to KSeF Sandbox Gateway.`,
        'success'
      );
    }, 1200);
  };

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
        <div className="lg:col-span-5 bg-white border border-stone-200/90 rounded-xl p-5 hover:border-red-300 transition-all shadow-xs space-y-5">
          <div className="border-b pb-3 border-stone-100">
            <h4 className="font-semibold text-stone-850 text-xs uppercase tracking-wider">{t('offline.retryOrchestration')}</h4>
            <p className="text-stone-500 text-[11px]">{t('offline.legalNotice')}</p>
          </div>

          <div className="space-y-4">
            <div className="bg-stone-50 border p-5 rounded-xl text-center space-y-2">
              <div className="text-[10px] text-stone-400 uppercase font-bold tracking-widest">{t('offline.queueSize')}</div>
              <div className="text-3xl font-extrabold text-stone-850">
                {offlineInvoices.length} <span className="text-xs font-normal text-stone-500">{t('offline.documentsSuffix')}</span>
              </div>

              {offlineInvoices.length > 0 ? (
                <div className="space-y-3 pt-2 text-xs">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 rounded-full font-semibold animate-pulse">
                    <RefreshCw size={12} className="animate-spin-slow" /> {t('offline.retryEvaluation', { seconds: secondsLeft })}
                  </div>
                  <p className="text-[10.5px] text-orange-700 leading-normal font-medium bg-orange-50 p-2.5 rounded-lg border border-orange-100">
                    {govStatus === 'Connected'
                      ? t('offline.statusConnected')
                      : t('offline.statusDisconnected')
                    }
                  </p>
                </div>
              ) : (
                <div className="text-xs text-stone-400 py-3">
                  {t('offline.nominalStatus')}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <button
                onClick={triggerManualBypass}
                disabled={isProcessingCollection || offlineInvoices.length === 0 || !canModify}
                className="w-full bg-red-700 hover:bg-red-800 text-stone-100 font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition"
              >
                <Zap size={14} className={isProcessingCollection ? 'animate-bounce' : ''} />
                {t('offline.btnConnectFlush')}
              </button>

              {govStatus !== 'Connected' && offlineInvoices.length > 0 && (
                <p className="text-[10px] text-center text-zinc-550 leading-snug">
                  {t('offline.btnNote')}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-stone-200/90 rounded-xl p-5 shadow-xs space-y-4">
          <div className="border-b pb-3 border-stone-100">
            <h4 className="font-semibold text-stone-850 text-xs uppercase tracking-wider">{t('offline.transactionsHeader')}</h4>
            <p className="text-stone-500 text-xs">{t('offline.transactionsDesc')}</p>
          </div>

          <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
            {offlineInvoices.map((inv) => (
              <div key={inv.id} className="border border-stone-200 p-4 rounded-xl hover:bg-stone-50/50 transition text-xs space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-mono font-bold text-stone-900 text-sm">{inv.invoiceNumber}</h5>
                    <p className="text-stone-505 mt-0.5 font-semibold text-[11px]">{inv.buyerName}</p>
                  </div>
                  <span className="bg-amber-50 text-amber-850 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                    {t('offline.failoverStatus')}
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

                {inv.lastErrorMessage && (
                  <div className="bg-red-50 border border-red-100 p-2.5 rounded-lg text-[10.5px] font-mono text-xs text-red-808 leading-normal whitespace-pre-wrap break-all">
                    {t('offline.logError', { error: inv.lastErrorMessage })}
                  </div>
                )}

                <OfflineComplianceCard invoice={inv} onAddNotification={onAddNotification} />
              </div>
            ))}

            {offlineInvoices.length === 0 && (
              <div className="text-center py-16 text-zinc-400 flex flex-col justify-center items-center h-48">
                <CheckCircle size={32} className="text-emerald-505 mb-2" />
                <p>{t('offline.emptyVaults')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
