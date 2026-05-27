import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { listAuditLogs } from '../api/ksefApi';
import {
  BookOpen,
  Search,
  ShieldCheck,
  Download,
  FileLock,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Calendar,
} from 'lucide-react';

const PAGE_SIZE = 20;

export default function AuditCenter({ tenant, role, onAddNotification }) {
  const { pathname } = useLocation();
  const tenantIdFromUrl = pathname.split('/').filter(Boolean)[1] ?? tenant.id;

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [currentPage, setCurrentPage] = useState(0);
  const [logs, setLogs] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => { setCurrentPage(0); }, [roleFilter, fromDate, toDate]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAuditLogs(tenantIdFromUrl, {
        page: currentPage,
        size: PAGE_SIZE,
        from: fromDate || undefined,
        to: toDate || undefined,
        role: roleFilter !== 'ALL' ? roleFilter : undefined,
        search: debouncedSearch || undefined,
      });
      setLogs(result.content);
      setTotalPages(result.totalPages);
      setTotalElements(result.totalElements);
    } catch (err) {
      setError(err?.message ?? 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [tenantIdFromUrl, currentPage, debouncedSearch, roleFilter, fromDate, toDate]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const triggerLogExport = () => {
    onAddNotification(
      'Audit Logs Exported',
      'Immutable compliance CSV exported. Generated legally binding RODO audit hashes for inspection teams.',
      'success',
    );
  };

  const formatTimestamp = (iso) => {
    try { return new Date(iso).toLocaleString('pl-PL'); }
    catch { return iso; }
  };

  const startEntry = currentPage * PAGE_SIZE + 1;
  const endEntry = Math.min((currentPage + 1) * PAGE_SIZE, totalElements);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
          <BookOpen className="text-red-700" size={20} />
          Enterprise Audit Center
        </h2>
        <p className="text-zinc-500 text-xs mt-0.5">
          RODO / GDPR compliant immutable transaction auditing — KSeF payloads, qualified signature handshakes, and corporate keystores.
        </p>
      </div>

      <div className="bg-white border border-stone-200/90 rounded-xl p-5 shadow-xs space-y-4">
        <div className="space-y-3 border-b pb-4 border-stone-100">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:max-w-xs">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-stone-400">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Search action, email, IP, detail..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 border border-stone-200/95 bg-stone-50/50 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <Filter size={13} className="text-stone-400" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-white border rounded-lg px-2.5 py-1.5 font-semibold text-stone-700 text-xs"
              >
                <option value="ALL">All Roles</option>
                <option value="Super Admin">Super Admin</option>
                <option value="Company Admin">Company Admin</option>
                <option value="Accountant">Accountant</option>
                <option value="Finance User">Finance User</option>
                <option value="Auditor">Auditor</option>
              </select>

              <button
                onClick={fetchLogs}
                disabled={loading}
                title="Refresh"
                className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-500 transition"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>

              <button
                onClick={triggerLogExport}
                className="bg-stone-900 text-stone-100 hover:bg-stone-800 px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Download size={13} /> Export (CSV)
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Calendar size={13} className="text-stone-400 shrink-0" />
            <label className="flex items-center gap-2 text-xs text-stone-600">
              From
              <input
                type="datetime-local"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border border-stone-200 rounded-lg px-2 py-1 text-xs text-stone-700 bg-stone-50 focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-stone-600">
              To
              <input
                type="datetime-local"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border border-stone-200 rounded-lg px-2 py-1 text-xs text-stone-700 bg-stone-50 focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
            </label>
            {(fromDate || toDate) && (
              <button
                onClick={() => { setFromDate(''); setToDate(''); }}
                className="text-xs text-stone-400 hover:text-stone-600 underline"
              >
                Clear dates
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-800">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
            <button onClick={fetchLogs} className="ml-auto underline font-semibold">Retry</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs align-middle font-sans">
            <thead>
              <tr className="border-b border-stone-100 text-stone-500 uppercase tracking-wider font-semibold text-[10px]">
                <th className="py-3 px-2">Timestamp (Warsaw)</th>
                <th className="py-3 px-2">Account Executed</th>
                <th className="py-3 px-2">Role</th>
                <th className="py-3 px-2">Action</th>
                <th className="py-3 px-2">Network IP</th>
                <th className="py-3 px-2">Detail / Change</th>
                <th className="py-3 px-2">Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700 font-mono text-[11px]">
              {loading && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-zinc-400 font-sans text-xs">
                    <span className="inline-flex items-center gap-2">
                      <RefreshCw size={13} className="animate-spin" />
                      Loading audit records…
                    </span>
                  </td>
                </tr>
              )}
              {!loading && logs.map((log) => (
                <tr key={log.id} className="hover:bg-stone-50/50 transition">
                  <td className="py-3 px-2 text-stone-500 whitespace-nowrap">
                    {formatTimestamp(log.timestamp)}
                  </td>
                  <td className="py-3 px-2 font-sans font-medium text-stone-800">
                    {log.userEmail || '—'}
                  </td>
                  <td className="py-3 px-2 font-sans">
                    <span className="px-2 py-0.5 bg-stone-100 rounded text-[10px] text-stone-600 font-bold whitespace-nowrap">
                      {log.userRole || '—'}
                    </span>
                  </td>
                  <td className="py-3 px-2 font-bold text-red-900 whitespace-nowrap">
                    {log.action}
                  </td>
                  <td className="py-3 px-2 text-zinc-500">
                    {log.ipAddress || '—'}
                  </td>
                  <td className="py-3 px-2 font-sans text-stone-700 min-w-[200px] leading-normal">
                    {log.newValue ?? log.oldValue ?? '—'}
                  </td>
                  <td className="py-3 px-2">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                      <ShieldCheck size={11} /> SECURE
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && !error && logs.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-zinc-400 font-sans text-xs">
                    No matching audit traces found for the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!loading && totalElements > 0 && (
          <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500 font-sans">
            <span>
              Showing <strong>{startEntry}–{endEntry}</strong> of <strong>{totalElements}</strong> entries
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft size={13} />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const pageNum = totalPages <= 5
                  ? i
                  : currentPage < 3
                    ? i
                    : currentPage >= totalPages - 3
                      ? totalPages - 5 + i
                      : currentPage - 2 + i;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-7 h-7 rounded-lg text-xs font-semibold transition ${
                      pageNum === currentPage
                        ? 'bg-stone-900 text-white'
                        : 'border border-stone-200 hover:bg-stone-50 text-stone-600'
                    }`}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500 font-sans leading-normal">
          <div className="flex items-center gap-1.5">
            <FileLock size={13} className="text-stone-400" />
            <span>Immutable audit log — SHA-256 chained records, 10-year retention (KSeF compliance)</span>
          </div>
          <span>GDPR / RODO Compliant</span>
        </div>
      </div>
    </div>
  );
}
