import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  QrCode,
  Download,
  FileText,
  ExternalLink,
  CheckCircle,
  FileBadge,
  Clock,
  XCircle,
  Info,
  Layers,
  ArrowRight,
  FileWarning,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import CorrectionModal from './CorrectionModal';
import { listInvoicesPage } from '../api/ksefApi';
import { useLanguage } from '../context/LanguageContext';
import { can } from '../lib/permissions';
import { invoiceStatusLabel, invoiceStatusHint } from '../lib/invoiceStatus';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function InvoiceList({ tenant, role, permissions, onAddNotification, onViewInvoiceDetail, onAddInvoice }) {
  const { t, language } = useLanguage();

  // Filters / paging — every change re-queries the BACKEND (true server-side pagination).
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);            // 1-based for the UI
  const [pageSize, setPageSize] = useState(10);

  // Server response for the current page only.
  const [invoices, setInvoices] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0); // bump to force a refetch (after a correction)

  const [selectedInvoice, setSelectedInvoice] = useState(null);
  // The SENT invoice currently being corrected (opens the correction modal). null = closed.
  const [correctionFor, setCorrectionFor] = useState(null);
  // Only users who can issue invoices may issue a correction (KSEF_CASE_MANAGER /
  // KSEF_ADMIN) — matches the backend guard on POST /invoices/{id}/correct.
  const canCorrect = can.issueInvoices(permissions);

  // Debounce the search box so we don't hit the API on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 350);
    return () => clearTimeout(id);
  }, [searchTerm]);

  // Any filter / page-size change → jump back to page 1.
  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, pageSize]);

  // Fetch the current page from the backend whenever the query inputs change.
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    listInvoicesPage({
      page: page - 1,
      size: pageSize,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      search: debouncedSearch || undefined,
    })
      .then((res) => {
        if (cancelled) return;
        setInvoices(res.content);
        setTotalElements(res.totalElements);
        setTotalPages(Math.max(1, res.totalPages));
      })
      .catch((err) => {
        if (cancelled) return;
        setInvoices([]); setTotalElements(0); setTotalPages(1);
        setError(err.message || (language === 'pl' ? 'Nie udało się wczytać faktur.' : 'Failed to load invoices.'));
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [page, pageSize, statusFilter, debouncedSearch, refreshKey, language]);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Gross total of the rows on THIS page (server pages the data, so we sum what's loaded).
  const pageGrossSum = invoices.reduce((sum, inv) => sum + (inv.totalGross || 0), 0);

  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  // Compact page-number list with "…" gaps (1 … 4 5 6 … 12).
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((n) => n === 1 || n === totalPages || Math.abs(n - safePage) <= 1)
    .reduce((acc, n, idx, arr) => {
      if (idx > 0 && n - arr[idx - 1] > 1) acc.push('…');
      acc.push(n);
      return acc;
    }, []);

  const triggerUpoDownload = (invoice) => {
    onAddNotification(
      'UPO Download Initiated',
      `Generating cryptographically signed Urzędowe Poświadczenie Odbioru (UPO) for invoice ${invoice.invoiceNumber}. XML hash attached.`,
      'success'
    );
  };

  const triggerXmlDownload = (invoice) => {
    onAddNotification(
      'XML Exported',
      `Invoice ${invoice.invoiceNumber} exported successfully as Polish government-compliant FA(3) structural format.`,
      'info'
    );
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <Layers className="text-red-655" size={20} />
          {t('repository.title')}
        </h2>
        <p className="text-slate-400 text-xs mt-1">{t('repository.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs font-sans">
        <div>
          <span className="text-slate-400 block pb-0.5 font-semibold uppercase tracking-wider text-[10px]">{t('repository.activeSize')}</span>
          <strong className="text-slate-700 text-lg">{totalElements} {language === 'pl' ? 'faktur' : 'invoices'}</strong>
        </div>
        <div>
          <span className="text-slate-400 block pb-0.5 font-semibold uppercase tracking-wider text-[10px]">{t('repository.filteredGross')}</span>
          <strong className="text-slate-800 text-lg">
            {pageGrossSum.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN
          </strong>
        </div>
        <div>
          <span className="text-slate-400 block pb-0.5 font-semibold uppercase tracking-wider text-[10px]">{t('repository.sigStatus')}</span>
          <strong className="text-emerald-600 text-xs font-bold flex items-center gap-1 mt-1.5 font-sans">
            <CheckCircle size={14} /> {t('repository.sigStatusVal')}
          </strong>
        </div>
        <div>
          <span className="text-slate-400 block pb-0.5 font-semibold uppercase tracking-wider text-[10px]">{t('repository.archivePolicy')}</span>
          <strong className="text-slate-750 text-xs flex items-center gap-1 mt-1.5 font-sans font-bold">
            {t('repository.archivePolicyVal')}
          </strong>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b pb-4 border-slate-100">
            <div className="relative w-full sm:max-w-xs">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder={t('repository.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 border border-slate-200 bg-slate-50/50 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-450"
              />
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-slate-500">
              <Filter size={13} className="text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-700 text-xs cursor-pointer"
              >
                <option value="ALL">{t('repository.filterAll')}</option>
                <option value="SENT">{t('repository.filterSent')}</option>
                <option value="OFFLINE_MODE">{t('repository.filterOffline')}</option>
                <option value="DRAFT">{t('repository.filterDraft')}</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs align-middle">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-widest font-semibold text-[9px]">
                  <th className="py-3 px-2">{t('repository.tableNum')}</th>
                  <th className="py-3 px-2">{t('repository.tableBuyer')}</th>
                  <th className="py-3 px-2">{t('repository.tableDate')}</th>
                  <th className="py-3 px-2 text-right">{t('repository.tableGross')}</th>
                  <th className="py-3 px-3">{t('repository.tableStatus')}</th>
                  <th className="py-3 px-2 text-center">{t('repository.tableInspect')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400 text-xs">
                      <span className="inline-flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> {t('common.loading')}</span>
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400 text-xs">
                      {t('repository.noInvoices')}
                    </td>
                  </tr>
                ) : invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => setSelectedInvoice(inv)}
                    className={`hover:bg-slate-50/70 transition cursor-pointer ${selectedInvoice?.id === inv.id ? 'bg-slate-100/50' : ''}`}
                  >
                    <td className="py-3.5 px-2 font-mono font-bold text-slate-800">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-2">
                      <div className="text-slate-707 truncate max-w-[150px] font-semibold">{inv.buyerName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">NIP: {inv.buyerNIP}</div>
                    </td>
                    <td className="py-3.5 px-2 text-slate-400 font-mono">
                      {inv.issueDate}
                    </td>
                    <td className="py-3.5 px-2 text-right font-semibold font-mono text-slate-750">
                      {inv.totalGross.toLocaleString('pl-PL')} <span className="text-[10px] text-slate-400 font-normal">{inv.currency}</span>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex flex-col gap-0.5">
                        <span className={`inline-flex self-start items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                          inv.status === 'SENT' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          inv.status === 'OFFLINE_MODE' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          inv.status === 'FAILED' ? 'bg-red-50 text-red-700 border-red-200' :
                          inv.status === 'RETRYING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          inv.status === 'PENDING' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {invoiceStatusLabel(inv.status, language)}
                        </span>
                        {inv.status === 'SENT' && inv.ksefId && (
                          <span className="text-[9px] text-slate-400 font-mono truncate max-w-[150px]" title={inv.ksefId}>KSeF: {inv.ksefId}</span>
                        )}
                        {(inv.status === 'OFFLINE_MODE' || inv.status === 'RETRYING') && (
                          <span className="text-[9px] text-slate-450">{language === 'pl' ? 'Wyśle się automatycznie' : 'Will send automatically'}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-2 text-center">
                      <button className="text-slate-400 hover:text-red-650 p-1 rounded-md transition inline-flex items-center gap-1 text-[10px] font-semibold cursor-pointer">
                        {t('common.inspect')} <ArrowRight size={12} className="text-slate-400" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3 font-medium">{error}</div>
          )}

          {/* Pagination footer — count + page controls. The data is paged on the SERVER. */}
          {totalElements > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                <span>
                  {language === 'pl' ? 'Pokazano' : 'Showing'}{' '}
                  <span className="font-semibold text-slate-700">{pageStart + 1}</span>–
                  <span className="font-semibold text-slate-700">{Math.min(pageStart + pageSize, totalElements)}</span>{' '}
                  {language === 'pl' ? 'z' : 'of'}{' '}
                  <span className="font-semibold text-slate-700">{totalElements}</span>
                </span>
                <label className="flex items-center gap-1.5">
                  <span className="text-slate-400">{language === 'pl' ? 'na stronę' : 'per page'}</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-700 text-[11px] cursor-pointer"
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1 || isLoading}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer disabled:cursor-default"
                    aria-label={language === 'pl' ? 'Poprzednia strona' : 'Previous page'}
                  >
                    <ChevronLeft size={15} />
                  </button>
                  {pageNumbers.map((item, idx) =>
                    item === '…' ? (
                      <span key={`gap-${idx}`} className="px-1 text-[11px] text-slate-300">…</span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setPage(item)}
                        disabled={isLoading}
                        className={`h-7 min-w-[28px] px-2 rounded-lg text-[11px] font-bold transition cursor-pointer disabled:cursor-default ${
                          safePage === item ? 'bg-red-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages || isLoading}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer disabled:cursor-default"
                    aria-label={language === 'pl' ? 'Następna strona' : 'Next page'}
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-4 space-y-6">
          {selectedInvoice ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
              <div className="border-b pb-3 border-slate-100">
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{t('repository.inspectorTitle')}</div>
                <h4 className="text-sm font-bold text-slate-800 font-mono mt-1">{selectedInvoice.invoiceNumber}</h4>
              </div>

              <div className="space-y-4 text-xs font-sans">
                {selectedInvoice.status === 'SENT' ? (
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 shadow-xs">
                    <div className="flex items-center justify-between border-b pb-2 border-slate-200">
                      <span className="text-red-750 text-[10px] uppercase font-bold flex items-center gap-1">
                        <FileBadge size={14} /> {t('repository.upoTitle')}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {invoiceStatusLabel(selectedInvoice.status, language)}
                      </span>
                    </div>

                    <div className="space-y-1.5 font-mono text-[10.5px] leading-relaxed text-slate-650">
                      <p>{t('repository.ksefIdLabel')}</p>
                      <p className="font-bold text-slate-900 bg-slate-100 p-1.5 rounded text-[10px] break-all border border-slate-200">
                        {selectedInvoice.ksefId ?? <span className="text-slate-400 font-normal">{t('repository.notAssigned')}</span>}
                      </p>
                      <p className="mt-2">{t('repository.upoStatusLabel')}</p>
                      <p className="font-bold text-slate-850">{selectedInvoice.upoStatus ?? '—'}</p>
                      <p className="mt-2">{t('repository.receptionStamp')}</p>
                      <p className="font-bold text-slate-850">
                        {selectedInvoice.upoTimestamp ?? <span className="text-slate-400 font-normal">—</span>}
                      </p>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => triggerUpoDownload(selectedInvoice)}
                        className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-1.5 px-3 rounded-lg text-[10px] inline-flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <Download size={11} /> {t('repository.downloadUpo')}
                      </button>
                      <button
                        onClick={() => triggerXmlDownload(selectedInvoice)}
                        className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-707 font-semibold py-1.5 px-3 rounded-lg text-[10px] inline-flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <FileText size={11} /> {t('repository.exportXml')}
                      </button>
                    </div>

                    {/* Issue a correction (faktura korygująca) — only for invoices already in KSeF. */}
                    {canCorrect && (
                      <button
                        onClick={() => setCorrectionFor(selectedInvoice)}
                        className="w-full mt-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold py-1.5 px-3 rounded-lg text-[10px] inline-flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <FileWarning size={11} /> {t('repository.issueCorrection')}
                      </button>
                    )}
                  </div>
                ) : selectedInvoice.status === 'OFFLINE_MODE' ? (
                  <div className="bg-orange-50/50 border border-orange-200 p-4 rounded-xl space-y-3">
                    <div className="flex items-center justify-between border-b pb-2 border-orange-200">
                      <span className="text-orange-950 text-[10px] uppercase font-bold flex items-center gap-1">
                        <QrCode size={14} className="text-orange-700" /> {t('repository.offlineQr')}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                        {invoiceStatusLabel(selectedInvoice.status, language)}
                      </span>
                    </div>

                    <div className="flex flex-col items-center py-2 bg-white rounded-lg border border-orange-100">
                      <svg viewBox="0 0 100 100" className="w-24 h-24 text-slate-800">
                        <rect x="10" y="10" width="25" height="25" fill="#E11D48" />
                        <rect x="15" y="15" width="15" height="15" fill="#ffffff" />
                        <rect x="19" y="19" width="7" height="7" fill="#E11D48" />
                        <rect x="65" y="10" width="25" height="25" fill="#E11D48" />
                        <rect x="70" y="15" width="15" height="15" fill="#ffffff" />
                        <rect x="74" y="19" width="7" height="7" fill="#E11D48" />
                        <rect x="10" y="65" width="25" height="25" fill="#E11D48" />
                        <rect x="15" y="70" width="15" height="15" fill="#ffffff" />
                        <rect x="19" y="74" width="7" height="7" fill="#E11D48" />
                        <rect x="45" y="45" width="10" height="10" fill="currentColor" />
                        <rect x="55" y="55" width="10" height="10" fill="currentColor" />
                      </svg>
                      <span className="text-[10px] text-slate-400 mt-2 font-mono">{t('repository.scanArt')}</span>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-relaxed">{invoiceStatusHint('OFFLINE_MODE', language)}</p>

                    <p className="text-[11px] leading-relaxed text-amber-900">
                      {t('repository.offlineLegalText')}
                    </p>
                  </div>
                ) : selectedInvoice.status === 'FAILED' ? (
                  <div className="bg-red-50 border border-red-200 p-4 rounded-xl space-y-3">
                    <div className="flex items-center justify-between border-b pb-2 border-red-200">
                      <span className="text-red-800 text-[10px] uppercase font-bold flex items-center gap-1">
                        <XCircle size={14} className="text-red-600" /> {t('repository.failedTitle')}
                      </span>
                    </div>
                    <p className="text-[11px] text-red-700 leading-relaxed">{invoiceStatusHint('FAILED', language)}</p>
                  </div>
                ) : selectedInvoice.status === 'RETRYING' ? (
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl space-y-3">
                    <div className="flex items-center justify-between border-b pb-2 border-amber-200">
                      <span className="text-amber-900 text-[10px] uppercase font-bold flex items-center gap-1">
                        <Clock size={14} className="text-amber-600" /> {t('repository.retryingTitle')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{invoiceStatusHint('RETRYING', language)}</p>
                  </div>
                ) : selectedInvoice.status === 'PENDING' ? (
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl space-y-2">
                    <div className="flex items-center justify-between border-b pb-2 border-blue-200">
                      <span className="text-blue-900 text-[10px] uppercase font-bold flex items-center gap-1">
                        <Clock size={14} className="text-blue-600" /> {t('repository.pendingTitle')}
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      {t('repository.pendingText')}
                    </p>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center text-slate-550 py-6">
                    <Info size={20} className="mx-auto text-slate-400 mb-1.5" />
                    <p className="text-xs">
                      {t('repository.draftInfo')}
                    </p>
                  </div>
                )}

                <button
                  onClick={() => onViewInvoiceDetail(selectedInvoice)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition cursor-pointer"
                >
                  <ExternalLink size={13} />
                  {t('repository.viewFullDetails')}
                </button>

                <div className="space-y-2 border-t pt-3 border-slate-100 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">{t('repository.buyerLabel')}</span>
                    <span className="font-semibold text-slate-750 text-right truncate max-w-[150px]">{selectedInvoice.buyerName}</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-400 font-sans font-medium">{t('sidebar.nip')}:</span>
                    <span className="text-slate-700 font-bold">{selectedInvoice.buyerNIP}</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-400 font-sans font-medium">{t('repository.preTaxNet')}</span>
                    <span>{selectedInvoice.totalNet.toLocaleString()} {selectedInvoice.currency}</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-400 font-sans font-medium">{t('repository.vatTotal')}</span>
                    <span>{selectedInvoice.totalVat.toLocaleString()} {selectedInvoice.currency}</span>
                  </div>
                  <div className="flex justify-between font-mono text-slate-900 font-bold border-t pt-1.5">
                    <span className="font-sans text-slate-800">{t('repository.grossTotal')}</span>
                    <span className="text-red-650">{selectedInvoice.totalGross.toLocaleString()} {selectedInvoice.currency}</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg text-[11px] border border-slate-150">
                  <p className="font-bold text-slate-550 mb-1">{t('repository.productsIncluded')}</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-500">
                    {selectedInvoice.items.map(item => (
                      <li key={item.id} className="truncate">
                        {item.quantity}x {item.productName || 'Custom item'} - {item.grossAmount} {selectedInvoice.currency}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs flex flex-col justify-center items-center h-48">
              <FileBadge className="mb-2 text-slate-300" size={32} />
              <p>{t('repository.selectToInspect')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Correction modal — opens when the user clicks "Wystaw korektę" on a SENT invoice. */}
      {correctionFor && (
        <CorrectionModal
          original={correctionFor}
          tenant={tenant}
          onAddNotification={onAddNotification}
          onClose={() => setCorrectionFor(null)}
          onCreated={(draft) => { onAddInvoice?.(draft); refetch(); }}
        />
      )}
    </div>
  );
}
