import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchAuditLogs } from "../store/slices/auditSlice";

// ─── Action metadata ──────────────────────────────────────────────────────────
// Maps every known action key to a human label and a colour group.
const ACTION_META = {
  EMPLOYEE_LIST_VIEWED:    { label: "Employee List Viewed",  color: "blue"   },
  EMPLOYEE_PROFILE_VIEWED: { label: "Profile Viewed",        color: "blue"   },
  DOCUMENT_VIEWED:         { label: "Document Viewed",       color: "blue"   },
  EMPLOYEE_PROFILE_CREATED:{ label: "Employee Created",      color: "green"  },
  EMPLOYEE_PROFILE_UPDATED:{ label: "Profile Updated",       color: "amber"  },
  DOCUMENT_UPLOADED:       { label: "Document Uploaded",     color: "purple" },
  COMPLIANCE_UPDATED:      { label: "Compliance Updated",    color: "indigo" },
  LOGIN:                   { label: "Login",                 color: "slate"  },
  LOGOUT:                  { label: "Logout",                color: "slate"  },
};

const COLOR_CLASSES = {
  blue:   "bg-blue-50   text-blue-700   ring-blue-200",
  green:  "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber:  "bg-amber-50  text-amber-700  ring-amber-200",
  purple: "bg-purple-50 text-purple-700 ring-purple-200",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  slate:  "bg-slate-100 text-slate-600  ring-slate-200",
};

function ActionBadge({ action }) {
  const meta   = ACTION_META[action];
  const label  = meta?.label  ?? action.replace(/_/g, " ");
  const color  = meta?.color  ?? "slate";
  const cls    = COLOR_CLASSES[color] ?? COLOR_CLASSES.slate;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${cls}`}>
      {label}
    </span>
  );
}

function StatusBadge({ success }) {
  return success === false ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Failed
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Success
    </span>
  );
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function formatDateTime(d) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(new Date(d));
}

function relativeTime(d) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function truncate(str, n = 18) {
  if (!str) return "—";
  return str.length > n ? `${str.slice(0, n)}…` : str;
}

// ─── Component ────────────────────────────────────────────────────────────────
function AuditReport() {
  const dispatch = useDispatch();
  const { logs, pagination, loading, error } = useSelector((s) => s.audit);

  // Filter state
  const [search, setSearch]         = useState("");
  const [debouncedSearch, setDbSearch] = useState("");
  const [action, setAction]         = useState("ALL");
  const [resource, setResource]     = useState("ALL");
  const [startDate, setStartDate]   = useState("");
  const [endDate, setEndDate]       = useState("");

  // Pagination state
  const [currentPage, setCurrentPage]   = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDbSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Re-fetch whenever any filter or page changes
  useEffect(() => {
    dispatch(fetchAuditLogs({
      search:    debouncedSearch || undefined,
      action:    action    !== "ALL" ? action    : undefined,
      resource:  resource  !== "ALL" ? resource  : undefined,
      startDate: startDate || undefined,
      endDate:   endDate   || undefined,
      page:      currentPage,
      limit:     itemsPerPage,
    }));
  }, [debouncedSearch, action, resource, startDate, endDate, currentPage, itemsPerPage, dispatch]);

  // Reset page on filter change
  function handleSearchChange(v)   { setSearch(v);   setCurrentPage(1); }
  function handleActionChange(v)   { setAction(v);   setCurrentPage(1); }
  function handleResourceChange(v) { setResource(v); setCurrentPage(1); }
  function handleStartDate(v)      { setStartDate(v); setCurrentPage(1); }
  function handleEndDate(v)        { setEndDate(v);   setCurrentPage(1); }
  function handleLimitChange(v)    { setItemsPerPage(Number(v)); setCurrentPage(1); }

  const total      = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;

  // Compute quick stats from current page (rough indicator)
  const successCount = logs.filter((l) => l.success !== false).length;
  const failCount    = logs.filter((l) => l.success === false).length;
  const uniqueUsers  = new Set(logs.map((l) => l.userEmail).filter(Boolean)).size;

  const isFiltered = search || action !== "ALL" || resource !== "ALL" || startDate || endDate;

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-2 inline-flex rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-indigo-200 ring-1 ring-white/20">
                SafeWork Compliance
              </p>
              <h1 className="text-3xl font-bold">Audit Trail</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Complete immutable record of every action performed — who accessed which records, made changes, and when.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="rounded-2xl bg-white/10 px-5 py-3 text-center ring-1 ring-white/20">
                <p className="text-2xl font-bold">{loading ? "…" : total.toLocaleString()}</p>
                <p className="text-xs text-slate-300">Total Events</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Error ──────────────────────────────────────────────────────── */}
        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Quick stats strip ───────────────────────────────────────────── */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">This Page</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{loading ? "…" : logs.length}</p>
            <p className="text-xs text-slate-400">records shown</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Successful</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{loading ? "…" : successCount}</p>
            <p className="text-xs text-slate-400">on this page</p>
          </div>
          <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Failed</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{loading ? "…" : failCount}</p>
            <p className="text-xs text-slate-400">on this page</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Unique Users</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">{loading ? "…" : uniqueUsers}</p>
            <p className="text-xs text-slate-400">on this page</p>
          </div>
        </div>

        {/* ── Filters ────────────────────────────────────────────────────── */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Filter Events</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {/* Search */}
            <div className="xl:col-span-2">
              <input
                type="text"
                placeholder="Search email, action, record ID…"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
              />
            </div>

            {/* Action */}
            <select
              value={action}
              onChange={(e) => handleActionChange(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
            >
              <option value="ALL">All Actions</option>
              <optgroup label="Read Events">
                <option value="EMPLOYEE_LIST_VIEWED">Employee List Viewed</option>
                <option value="EMPLOYEE_PROFILE_VIEWED">Profile Viewed</option>
                <option value="DOCUMENT_VIEWED">Document Viewed</option>
              </optgroup>
              <optgroup label="Write Events">
                <option value="EMPLOYEE_PROFILE_CREATED">Employee Created</option>
                <option value="EMPLOYEE_PROFILE_UPDATED">Profile Updated</option>
                <option value="DOCUMENT_UPLOADED">Document Uploaded</option>
                <option value="COMPLIANCE_UPDATED">Compliance Updated</option>
              </optgroup>
              <optgroup label="Auth Events">
                <option value="LOGIN">Login</option>
                <option value="LOGOUT">Logout</option>
              </optgroup>
            </select>

            {/* Resource */}
            <select
              value={resource}
              onChange={(e) => handleResourceChange(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
            >
              <option value="ALL">All Resources</option>
              <option value="EmployeeProfile">Employee Profile</option>
              <option value="EmployeeDocument">Employee Document</option>
              <option value="User">User</option>
            </select>

            {/* Date from */}
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleStartDate(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
            />

            {/* Date to */}
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleEndDate(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
            />
          </div>

          {/* Active filter chips + clear */}
          {isFiltered && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400">Active filters:</span>
              {search    && <Chip label={`Search: "${search}"`}    onRemove={() => handleSearchChange("")} />}
              {action !== "ALL"   && <Chip label={`Action: ${action}`}     onRemove={() => handleActionChange("ALL")} />}
              {resource !== "ALL" && <Chip label={`Resource: ${resource}`} onRemove={() => handleResourceChange("ALL")} />}
              {startDate && <Chip label={`From: ${startDate}`}  onRemove={() => handleStartDate("")} />}
              {endDate   && <Chip label={`To: ${endDate}`}      onRemove={() => handleEndDate("")} />}
              <button
                onClick={() => { handleSearchChange(""); handleActionChange("ALL"); handleResourceChange("ALL"); handleStartDate(""); handleEndDate(""); }}
                className="text-xs font-semibold text-red-600 hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* ── Table card ──────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          {/* Table header bar */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Event Log</h2>
              <p className="text-sm text-slate-500">
                {loading ? "Loading…" : (() => {
                  const from = total === 0 ? 0 : (pagination?.page - 1) * pagination?.limit + 1;
                  const to   = Math.min(pagination?.page * pagination?.limit, total);
                  return `Showing ${from}–${to} of ${total.toLocaleString()} event${total !== 1 ? "s" : ""}`;
                })()}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-500">
              Rows per page
              <select
                value={itemsPerPage}
                onChange={(e) => handleLimitChange(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-500"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
          </div>

          {loading ? (
            <div className="py-16 text-center">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              <p className="text-sm text-slate-500">Loading audit events…</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-separate border-spacing-y-1.5">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2">Timestamp</th>
                    <th className="px-3 py-2">Performed By</th>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Resource</th>
                    <th className="px-3 py-2">Affected Employee</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log._id} className="bg-slate-50 text-sm transition hover:bg-blue-50/60">
                      <td className="rounded-l-xl px-3 py-3">
                        <p className="font-medium text-slate-800">{formatDateTime(log.createdAt)}</p>
                        <p className="text-xs text-slate-400">{relativeTime(log.createdAt)}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-800">{log.userEmail || "—"}</p>
                        {log.userId && (
                          <p className="text-xs text-slate-400" title={log.userId}>
                            ID: {truncate(log.userId, 16)}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-3 py-3 text-slate-600">{log.resource || "—"}</td>
                      <td className="px-3 py-3">
                        {log.resourceName ? (
                          <div>
                            <p className="font-semibold text-slate-800">{log.resourceName}</p>
                            {log.resourceId && (
                              <p
                                className="mt-0.5 cursor-default font-mono text-[11px] text-slate-400"
                                title={log.resourceId}
                              >
                                {truncate(log.resourceId, 14)}
                              </p>
                            )}
                          </div>
                        ) : log.resourceId ? (
                          <span
                            className="cursor-default rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs text-slate-500"
                            title={log.resourceId}
                          >
                            {truncate(log.resourceId)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge success={log.success} />
                        {log.errorMessage && (
                          <p className="mt-1 max-w-[180px] truncate text-xs text-red-600" title={log.errorMessage}>
                            {log.errorMessage}
                          </p>
                        )}
                      </td>
                      <td className="rounded-r-xl px-3 py-3 font-mono text-xs text-slate-500">
                        {log.ipAddress || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {logs.length === 0 && !loading && (
                <div className="py-12 text-center">
                  <p className="font-semibold text-slate-700">
                    {isFiltered ? "No events match your filters" : "No audit events recorded yet"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {isFiltered
                      ? "Try adjusting your filters or date range."
                      : "Events will appear here as users interact with the system."}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Pagination ──────────────────────────────────────────────── */}
          {!loading && total > 0 && (
            <div className="mt-5 flex flex-col items-center gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-between">
              <p className="text-sm text-slate-500">
                Page {pagination?.page} of {totalPages}
              </p>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ←
                </button>

                {(() => {
                  const pages = [];
                  const nums  = new Set([1, totalPages]);
                  for (let i = currentPage - 2; i <= currentPage + 2; i++) {
                    if (i >= 1 && i <= totalPages) nums.add(i);
                  }
                  const sorted = [...nums].sort((a, b) => a - b);
                  sorted.forEach((n, idx) => {
                    if (idx > 0 && n - sorted[idx - 1] > 1) {
                      pages.push(<span key={`gap-${n}`} className="px-1 text-sm text-slate-400">…</span>);
                    }
                    pages.push(
                      <button
                        key={n}
                        onClick={() => setCurrentPage(n)}
                        className={`min-w-[2rem] rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                          n === currentPage
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {n}
                      </button>
                    );
                  });
                  return pages;
                })()}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  →
                </button>
              </div>

              {totalPages > 1 && (
                <label className="flex items-center gap-2 text-sm text-slate-500">
                  Go to page
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    defaultValue={currentPage}
                    key={currentPage}
                    onBlur={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (v >= 1 && v <= totalPages) setCurrentPage(v);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const v = parseInt(e.target.value, 10);
                        if (v >= 1 && v <= totalPages) setCurrentPage(v);
                      }
                    }}
                    className="w-14 rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm text-slate-700 outline-none focus:border-indigo-500"
                  />
                </label>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Small helper chip for active filter display
function Chip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
      {label}
      <button onClick={onRemove} className="ml-0.5 text-indigo-400 hover:text-indigo-700">✕</button>
    </span>
  );
}

export default AuditReport;
