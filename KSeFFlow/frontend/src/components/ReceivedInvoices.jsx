import { useState, useEffect, useCallback } from 'react';
import { Inbox, RefreshCw, FileText, Download, Loader2, Paperclip } from 'lucide-react';
import { listReceivedInvoices, syncReceivedInvoices, getReceivedInvoiceXml } from '../api/ksefApi';

// ── Received (purchase) invoices — faktury otrzymane ──────────────────────────
// SIMPLE EXPLANATION:
// KSeF works both ways. As well as sending the invoices WE issue, the law (from 1 Feb 2026)
// says every company must be able to RECEIVE the invoices OTHER companies issue to them.
// This screen pulls those purchase invoices down from KSeF and lets the user browse them and
// open the full XML. The tenant's own NIP is the "I am the buyer" context for the backend.
export default function ReceivedInvoices({ tenant, onAddNotification }) {
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
      .catch(err => setError(err.message || 'Nie udało się wczytać faktur otrzymanych.'))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  // Ask KSeF for any new purchase invoices, then refresh the list.
  const handleSync = async () => {
    if (!nip) {
      onAddNotification?.('Brak NIP', 'Brak numeru NIP organizacji — nie można pobrać faktur z KSeF.', 'error');
      return;
    }
    setIsSyncing(true);
    setError(null);
    try {
      const res = await syncReceivedInvoices(nip);
      onAddNotification?.(
        'Synchronizacja zakończona',
        `Pobrano ${res.fetched ?? 0}, dodano ${res.created ?? 0} nowych faktur otrzymanych.`,
        'success',
      );
      loadList();
    } catch (err) {
      const msg = err.message || 'Synchronizacja z KSeF nie powiodła się.';
      setError(msg);
      onAddNotification?.('Błąd synchronizacji', msg, 'error');
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
      onAddNotification?.('Błąd pobierania XML', err.message || 'Nie udało się pobrać XML faktury.', 'error');
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
    <div className="space-y-6 max-w-6xl">
      {/* Header + sync action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 text-white rounded-xl p-2"><Inbox size={18} /></div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">Faktury otrzymane</h2>
            <p className="text-xs text-slate-500">Faktury zakupowe wystawione na Twoją firmę w KSeF.</p>
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold py-2 px-4 rounded-xl text-xs transition cursor-pointer"
        >
          {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {isSyncing ? 'Pobieranie z KSeF…' : 'Pobierz z KSeF'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3">{error}</div>
      )}

      {/* The table of received invoices */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm gap-2">
            <Loader2 size={16} className="animate-spin" /> Wczytywanie…
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-16 px-6 space-y-2">
            <Inbox size={28} className="mx-auto text-slate-300" />
            <p className="text-sm text-slate-500">Brak faktur otrzymanych.</p>
            <p className="text-xs text-slate-400">Kliknij „Pobierz z KSeF”, aby pobrać faktury zakupowe.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide text-[10px]">
                <tr>
                  <th className="text-left font-bold px-4 py-3">Numer KSeF</th>
                  <th className="text-left font-bold px-4 py-3">Nr faktury</th>
                  <th className="text-left font-bold px-4 py-3">Sprzedawca</th>
                  <th className="text-left font-bold px-4 py-3">Data</th>
                  <th className="text-right font-bold px-4 py-3">Brutto</th>
                  <th className="text-center font-bold px-4 py-3">Zał.</th>
                  <th className="text-right font-bold px-4 py-3">Akcja</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id || inv.ksefNumber} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600 break-all max-w-[220px]">{inv.ksefNumber}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{inv.invoiceNumber || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="block font-medium">{inv.sellerName || '—'}</span>
                      <span className="block text-[10px] text-slate-400 font-mono">{inv.sellerNip || ''}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{shortDate(inv.issueDate)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">{money(inv.grossAmount, inv.currency)}</td>
                    <td className="px-4 py-3 text-center">
                      {inv.hasAttachment ? <Paperclip size={13} className="inline text-slate-500" /> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleViewXml(inv.ksefNumber)}
                        className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold py-1.5 px-3 rounded-lg text-[11px] transition cursor-pointer"
                      >
                        <FileText size={12} /> Pokaż XML
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
          <div className="bg-white rounded-xl shadow-lg w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={15} className="text-slate-500 shrink-0" />
                <span className="font-mono text-[11px] text-slate-600 truncate">{xmlModal.ksefNumber}</span>
              </div>
              <div className="flex items-center gap-2">
                {xmlModal.xml && (
                  <button onClick={downloadXml} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 hover:text-slate-900 cursor-pointer">
                    <Download size={13} /> Pobierz
                  </button>
                )}
                <button onClick={() => setXmlModal(null)} className="text-slate-400 hover:text-slate-700 text-xs cursor-pointer">Zamknij</button>
              </div>
            </div>
            <div className="overflow-auto p-4">
              {xmlModal.loading ? (
                <div className="flex items-center justify-center h-40 text-slate-400 text-sm gap-2">
                  <Loader2 size={16} className="animate-spin" /> Pobieranie XML z KSeF…
                </div>
              ) : (
                <pre className="text-[10.5px] leading-relaxed text-slate-700 whitespace-pre-wrap break-all font-mono">{xmlModal.xml}</pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
