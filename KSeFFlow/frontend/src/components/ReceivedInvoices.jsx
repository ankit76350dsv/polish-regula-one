import { useState, useEffect, useCallback } from 'react';
import { Inbox, RefreshCw, FileText, Download, Loader2, Paperclip } from 'lucide-react';
import { listReceivedInvoices, syncReceivedInvoices, getReceivedInvoiceXml } from '../api/ksefApi';
import { useLanguage } from '../context/LanguageContext';
import { can } from '../lib/permissions';

// ── Received (purchase) invoices — faktury otrzymane ──────────────────────────
// SIMPLE EXPLANATION:
// KSeF works both ways. As well as sending the invoices WE issue, the law (from 1 Feb 2026)
// says every company must be able to RECEIVE the invoices OTHER companies issue to them.
// This screen pulls those purchase invoices down from KSeF and lets the user browse them and
// open the full XML. The tenant's own NIP is the "I am the buyer" context for the backend.
export default function ReceivedInvoices({ tenant, permissions, onAddNotification }) {
  const { language, t } = useLanguage();
  // Pulling new invoices from KSeF requires KSEF_CASE_MANAGER (or KSEF_ADMIN) —
  // matches the backend guard on POST /received-invoices/sync. Browsing the list is
  // open to read roles, so only the Sync button is gated here.
  const canSync = can.issueInvoices(permissions);
  const [invoices, setInvoices]   = useState([]);
  const [isLoading, setIsLoading] = useState(false); // loading the saved list
  const [isSyncing, setIsSyncing] = useState(false); // pulling fresh data from KSeF
  const [error, setError]         = useState(null);

  // The XML viewer modal (opened when the user clicks "Pokaż XML").
  const [xmlModal, setXmlModal]   = useState(null); // { ksefNumber, xml } | { ksefNumber, loading:true }

  const nip = tenant?.nip || '';

  // Load the invoices we have already stored locally (fast — no KSeF call).
  const loadList = useCallback(() => {
    setIsLoading(true);
    setError(null);
    listReceivedInvoices({ page: 0, size: 100 })
      .then(res => setInvoices(res.content))
      .catch(err => setError(err.message || (language === 'pl' ? 'Nie udało się wczytać faktur otrzymanych.' : 'Failed to load received invoices.')))
      .finally(() => setIsLoading(false));
  }, [language]);

  useEffect(() => { loadList(); }, [loadList]);

  // Ask KSeF for any new purchase invoices, then refresh the list.
  const handleSync = async () => {
    // Backend will reject this with 403 unless the user can issue invoices; guard the UI too.
    if (!canSync) {
      onAddNotification?.(
        language === 'pl' ? 'Brak uprawnień' : 'Not allowed',
        language === 'pl'
          ? 'Pobieranie faktur z KSeF wymaga uprawnienia menedżera faktur.'
          : 'Downloading invoices from KSeF requires the case manager permission.',
        'error',
      );
      return;
    }
    if (!nip) {
      onAddNotification?.(
        language === 'pl' ? 'Brak NIP' : 'No NIP', 
        language === 'pl' ? 'Brak numeru NIP organizacji — nie można pobrać faktur z KSeF.' : 'No corporate NIP found - cannot fetch invoices from KSeF.', 
        'error'
      );
      return;
    }
    setIsSyncing(true);
    setError(null);
    try {
      const res = await syncReceivedInvoices(nip);
      onAddNotification?.(
        language === 'pl' ? 'Synchronizacja zakończona' : 'Sync Completed',
        language === 'pl'
          ? `Pobrano ${res.fetched ?? 0}, dodano ${res.created ?? 0} nowych faktur otrzymanych.`
          : `Fetched ${res.fetched ?? 0}, added ${res.created ?? 0} new received invoices.`,
        'success',
      );
      loadList();
    } catch (err) {
      const msg = err.message || (language === 'pl' ? 'Synchronizacja z KSeF nie powiodła się.' : 'Synchronization with KSeF failed.');
      setError(msg);
      onAddNotification?.(language === 'pl' ? 'Błąd synchronizacji' : 'Sync Error', msg, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Fetch and show the full FA(3) XML for one invoice.
  const handleViewXml = async (ksefNumber) => {
    setXmlModal({ ksefNumber, loading: true });
    try {
      const xml = await getReceivedInvoiceXml(ksefNumber, nip);
      setXmlModal({ ksefNumber, xml: typeof xml === 'string' ? xml : JSON.stringify(xml, null, 2) });
    } catch (err) {
      setXmlModal(null);
      onAddNotification?.(
        language === 'pl' ? 'Błąd pobierania XML' : 'XML Retrieval Error', 
        err.message || (language === 'pl' ? 'Nie udało się pobrać XML faktury.' : 'Failed to fetch invoice XML.'), 
        'error'
      );
    }
  };

  // Save the currently-open XML to a file on the user's computer.
  const downloadXml = () => {
    if (!xmlModal?.xml) return;
    const blob = new Blob([xmlModal.xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${xmlModal.ksefNumber}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const money = (v, ccy) =>
    v == null ? '—' : `${Number(v).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${ccy || ''}`.trim();
  const shortDate = (iso) => (iso ? String(iso).slice(0, 10) : '—');

  return (
    <div className="space-y-6">
      {/* Header + sync action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 text-white rounded-xl p-2"><Inbox size={18} /></div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">{language === 'pl' ? 'Faktury otrzymane' : 'Received invoices'}</h2>
            <p className="text-xs text-slate-500">{language === 'pl' ? 'Faktury zakupowe wystawione na Twoją firmę w KSeF.' : 'Purchase invoices issued to your company in KSeF.'}</p>
          </div>
        </div>
        {canSync && (
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold py-2 px-4 rounded-xl text-xs transition cursor-pointer font-sans"
          >
            {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {isSyncing ? (language === 'pl' ? 'Pobieranie z KSeF…' : 'Downloading from KSeF…') : (language === 'pl' ? 'Pobierz z KSeF' : 'Download from KSeF')}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3 font-sans font-medium">{error}</div>
      )}

      {/* The table of received invoices */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden font-sans">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm gap-2">
            <Loader2 size={16} className="animate-spin" /> {t('common.loading')}
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-16 px-6 space-y-2">
            <Inbox size={28} className="mx-auto text-slate-300" />
            <p className="text-sm text-slate-500 font-bold">{language === 'pl' ? 'Brak faktur otrzymanych.' : 'No received invoices found.'}</p>
            <p className="text-xs text-slate-400">{language === 'pl' ? 'Kliknij „Pobierz z KSeF”, aby pobrać faktury zakupowe.' : 'Click "Download from KSeF" to pull purchase invoices.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs align-middle">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide text-[10px] font-semibold border-b border-slate-100">
                <tr>
                  <th className="font-bold px-4 py-3">{language === 'pl' ? 'Numer KSeF' : 'KSeF Number'}</th>
                  <th className="font-bold px-4 py-3">{language === 'pl' ? 'Nr faktury' : 'Invoice #'}</th>
                  <th className="font-bold px-4 py-3">{language === 'pl' ? 'Sprzedawca' : 'Seller'}</th>
                  <th className="font-bold px-4 py-3">{language === 'pl' ? 'Data' : 'Date'}</th>
                  <th className="text-right font-bold px-4 py-3">{language === 'pl' ? 'Brutto' : 'Gross'}</th>
                  <th className="text-center font-bold px-4 py-3">{language === 'pl' ? 'Zał.' : 'Att.'}</th>
                  <th className="text-right font-bold px-4 py-3">{language === 'pl' ? 'Akcja' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {invoices.map((inv) => (
                  <tr key={inv.id || inv.ksefNumber} className="hover:bg-slate-50/70 transition cursor-pointer">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-655 break-all max-w-[220px]">{inv.ksefNumber}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{inv.invoiceNumber || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="block font-semibold text-slate-800">{inv.sellerName || '—'}</span>
                      <span className="block text-[10px] text-slate-400 font-mono">NIP: {inv.sellerNip || ''}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-mono">{shortDate(inv.issueDate)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-750">{money(inv.grossAmount, inv.currency)}</td>
                    <td className="px-4 py-3 text-center">
                      {inv.hasAttachment ? <Paperclip size={13} className="inline text-slate-450" /> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleViewXml(inv.ksefNumber)}
                        className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-707 font-semibold py-1.5 px-3 rounded-lg text-[11px] transition cursor-pointer"
                      >
                        <FileText size={12} /> {language === 'pl' ? 'Pokaż XML' : 'Show XML'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* XML viewer modal */}
      {xmlModal && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4" onClick={() => setXmlModal(null)}>
          <div className="bg-white rounded-xl shadow-lg w-full max-w-3xl max-h-[85vh] flex flex-col font-sans" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={15} className="text-slate-500 shrink-0" />
                <span className="font-mono text-[11px] text-slate-600 truncate">{xmlModal.ksefNumber}</span>
              </div>
              <div className="flex items-center gap-2">
                {xmlModal.xml && (
                  <button onClick={downloadXml} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 hover:text-slate-900 cursor-pointer">
                    <Download size={13} /> {language === 'pl' ? 'Pobierz' : 'Download'}
                  </button>
                )}
                <button onClick={() => setXmlModal(null)} className="text-slate-400 hover:text-slate-700 text-xs cursor-pointer">{t('common.close')}</button>
              </div>
            </div>
            <div className="overflow-auto p-4">
              {xmlModal.loading ? (
                <div className="flex items-center justify-center h-40 text-slate-400 text-sm gap-2">
                  <Loader2 size={16} className="animate-spin" /> {language === 'pl' ? 'Pobieranie XML z KSeF…' : 'Downloading XML from KSeF…'}
                </div>
              ) : (
                <pre className="text-[10.5px] leading-relaxed text-slate-700 whitespace-pre-wrap break-all font-mono bg-slate-50 p-3 rounded-lg border border-slate-150">{xmlModal.xml}</pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
