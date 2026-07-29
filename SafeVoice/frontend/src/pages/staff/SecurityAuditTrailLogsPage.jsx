import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { ChevronRight, Download, Search } from "lucide-react";
import { AppButton, AppTable, ConfirmDialog, EmptyState, ErrorState, PageSpinner, Pagination } from "../../components/ui";
import {
  fetchAudit,
  selectAuditLogs,
  selectAuditStatus,
  selectAuditTotal,
  selectAuditTotalPages,
} from "../../slices/auditSlice";
import { addToast } from "../../slices/uiSlice";
import { selectCurrentUser } from "../../slices/authSlice";
import { can } from "../../utils/permissions";

const PAGE_SIZE = 20;

// The action types and outcomes the backend knows about. Kept here so the filter
// dropdowns stay in step with the backend enums.
const ACTION_TYPES = [
  "REPORT_RECEIVED",
  "CASE_STATUS_CHANGED",
  "SEVERITY_CHANGED",
  "INVESTIGATOR_ASSIGNED",
  "MESSAGE_POSTED",
  "EVIDENCE_ADDED",
  "OFFICER_INVITED",
  "RETENTION_UPDATED",
  "LOGIN_SECURITY",
  "ACCESS_REVIEW",
];
const OUTCOMES = ["ALLOWED", "DENIED", "RECORDED"];

// Turn an enum name like "REPORT_RECEIVED" into a readable "Report received".
function pretty(value) {
  if (!value) return "";
  const lower = value.replace(/_/g, " ").toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export default function SecurityAuditTrailLogsPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const logs = useSelector(selectAuditLogs);
  const status = useSelector(selectAuditStatus);
  const total = useSelector(selectAuditTotal);
  const totalPages = useSelector(selectAuditTotalPages);
  const canExport = can(useSelector(selectCurrentUser), "exportData");

  // Filter controls. The backend does the search/filter/paging; we just hold the inputs.
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [actionType, setActionType] = useState("");
  const [outcome, setOutcome] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [confirmExport, setConfirmExport] = useState(false);

  // Debounce the free-text box so we query only after the user pauses typing.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  // Fetch whenever any filter or the page changes.
  useEffect(() => {
    dispatch(
      fetchAudit({ page, size: PAGE_SIZE, search: debouncedQuery, actionType, outcome, from, to }),
    );
  }, [dispatch, page, debouncedQuery, actionType, outcome, from, to]);

  // Any filter change restarts at page 1 (so we never sit on a now-empty page).
  const resetPage = () => setPage(1);

  // True only for the very FIRST load (no rows yet). Later filter/page changes keep the
  // previous rows on screen and just dim them, so the header and filters never reload.
  const firstLoad = status === "loading" && logs.length === 0;
  const refreshing = status === "loading" && logs.length > 0;

  return (
    <div className="w-full min-w-0 space-y-5 leading-relaxed">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">{t("audit.title")}</h1>
          <p className="text-xs text-slate-500 mt-1">{t("audit.subtitle")}</p>
        </div>
        {canExport && (
          <AppButton type="button" variant="outline" icon={<Download className="w-4 h-4" />} onClick={() => setConfirmExport(true)}>
            {t("audit.export")}
          </AppButton>
        )}
      </div>

      <div className="min-w-0 bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-3">
        <div className="flex min-w-0 flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="relative w-full md:max-w-sm">
            <label htmlFor="audit-search" className="sr-only">{t("common.search")}</label>
            <input
              id="audit-search"
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                resetPage();
              }}
              placeholder={t("audit.searchPlaceholder")}
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 rounded-lg py-2 pl-9 pr-4 text-xs font-semibold outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" aria-hidden="true" />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 p-2 rounded shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" aria-hidden="true" />
            <span className="text-[11px] font-medium text-slate-700">{t("audit.worm")}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:flex xl:flex-wrap xl:items-end">
          <div className="min-w-0">
            <label htmlFor="audit-action" className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">{t("audit.colAction")}</label>
            <select
              id="audit-action"
              value={actionType}
              onChange={(e) => { setActionType(e.target.value); resetPage(); }}
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 rounded-lg py-2 px-3 text-xs font-semibold outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            >
              <option value="">{t("audit.allActions")}</option>
              {ACTION_TYPES.map((a) => (
                <option key={a} value={a}>{pretty(a)}</option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor="audit-outcome" className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">{t("audit.colOutcome")}</label>
            <select
              id="audit-outcome"
              value={outcome}
              onChange={(e) => { setOutcome(e.target.value); resetPage(); }}
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 rounded-lg py-2 px-3 text-xs font-semibold outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            >
              <option value="">{t("audit.allOutcomes")}</option>
              {OUTCOMES.map((o) => (
                <option key={o} value={o}>{pretty(o)}</option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor="audit-from" className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">{t("audit.dateFrom")}</label>
            <input
              id="audit-from"
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); resetPage(); }}
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 rounded-lg py-2 px-3 text-xs font-semibold outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="audit-to" className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">{t("audit.dateTo")}</label>
            <input
              id="audit-to"
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); resetPage(); }}
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 rounded-lg py-2 px-3 text-xs font-semibold outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* Only THIS region swaps while filtering — the header and filters above stay put. */}
      {status === "failed" ? (
        <ErrorState
          onRetry={() =>
            dispatch(fetchAudit({ page, size: PAGE_SIZE, search: debouncedQuery, actionType, outcome, from, to }))
          }
        />
      ) : firstLoad ? (
        <PageSpinner label={t("common.loading")} />
      ) : logs.length === 0 ? (
        <EmptyState title={t("audit.empty")} />
      ) : (
        <div className={`min-w-0 ${refreshing ? "opacity-60 transition-opacity pointer-events-none" : "transition-opacity"}`} aria-busy={refreshing}>
          <AppTable className="min-w-0" headers={[t("audit.colTime"), t("audit.colActor"), t("audit.colAction"), t("audit.colOutcome"), t("audit.colMetadata")]}>
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50 border-b border-slate-200 transition-colors">
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                <td className="px-4 py-3 text-xs text-slate-800">
                  <div className="font-bold">{log.actorName}</div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-700">{pretty(log.actionType)}</td>
                <td className="px-4 py-3 text-xs text-emerald-700 font-semibold">{pretty(log.outcome)}</td>
                <td className="px-4 py-3 text-xs text-slate-500 max-w-sm break-words">
                  {log.metadataNotice}
                  {log.oldValue && log.newValue && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                      <span className="break-all">{log.oldValue}</span>
                      <ChevronRight className="w-3 h-3" aria-hidden="true" />
                      <span className="text-cyan-700 break-all">{log.newValue}</span>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </AppTable>
          <Pagination page={page} pageCount={totalPages || 1} total={total} onChange={setPage} />
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmExport}
        title={t("audit.confirmExportTitle")}
        message={t("audit.confirmExportBody")}
        onConfirm={() => {
          dispatch(addToast({ type: "success", message: t("toast.exported") }));
          setConfirmExport(false);
        }}
        onCancel={() => setConfirmExport(false)}
      />
    </div>
  );
}
