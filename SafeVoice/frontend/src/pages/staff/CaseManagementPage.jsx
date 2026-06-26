import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { AppButton, AppTable, EmptyState, ErrorState, PageSpinner, Pagination, SeverityBadge, StatusBadge } from "../../components/ui";
import { fetchReports, selectReports, selectReportsStatus } from "../../slices/reportsSlice";

const PAGE_SIZE = 8;
const FILTERS = ["all", "critical", "unassigned", "feedbackDue"];

export default function CaseManagementPage({ navigate }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const reports = useSelector(selectReports);
  const status = useSelector(selectReportsStatus);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (status === "idle") dispatch(fetchReports());
  }, [status, dispatch]);

  // Reset to first page whenever the search or filter changes.
  useEffect(() => setPage(1), [query, filter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports.filter((r) => {
      const matchesQuery =
        !q || r.id.toLowerCase().includes(q) || r.category.toLowerCase().includes(q);
      const matchesFilter =
        filter === "all" ||
        (filter === "critical" && r.severity === "Critical") ||
        (filter === "unassigned" && (r.assignedInvestigator === "Unassigned" || !r.assignedInvestigator)) ||
        (filter === "feedbackDue" && r.status !== "Closed");
      return matchesQuery && matchesFilter;
    });
  }, [reports, query, filter]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (status === "loading" && reports.length === 0) return <PageSpinner label={t("common.loading")} />;
  if (status === "failed") return <ErrorState message={t("cases.loadError")} onRetry={() => dispatch(fetchReports())} />;

  return (
    <div className="space-y-6 max-w-6xl mx-auto leading-relaxed">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">{t("cases.title")}</h1>
          <p className="text-xs text-slate-500 mt-1">{t("cases.subtitle")}</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-4 bg-white p-4 rounded-lg border border-slate-200 justify-between shadow-xs">
        <div className="relative w-full md:max-w-xs">
          <label htmlFor="case-search" className="sr-only">{t("common.search")}</label>
          <input
            id="case-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("cases.searchPlaceholder")}
            className="w-full bg-slate-50 border border-slate-300 text-slate-800 rounded-lg py-2 pl-9 pr-4 text-xs font-semibold outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" aria-hidden="true" />
        </div>
        <div className="flex flex-wrap gap-2 text-xs" role="group" aria-label={t("common.filter")}>
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-lg border px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                filter === f ? "border-cyan-300 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
              }`}
            >
              {t(`cases.filter${f.charAt(0).toUpperCase() + f.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={t("cases.empty")} />
      ) : (
        <>
          <AppTable
            headers={[
              t("cases.colCase"),
              t("cases.colCategory"),
              t("cases.colStatus"),
              t("cases.colSeverity"),
              t("cases.colInvestigator"),
              t("cases.colFeedbackDue"),
              "",
            ]}
          >
            {pageRows.map((report) => (
              <tr key={report.id} className="hover:bg-slate-50 border-b border-slate-200 transition-colors">
                <td className="px-4 py-3 text-xs">
                  <div className="font-bold text-slate-900">{report.id}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{report.disclosureMode}</div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-700">{t(`categories.${report.category}`, report.category)}</td>
                <td className="px-4 py-3 text-xs"><StatusBadge status={report.status} /></td>
                <td className="px-4 py-3 text-xs"><SeverityBadge severity={report.severity} /></td>
                <td className="px-4 py-3 text-xs text-slate-700">
                  {report.assignedInvestigator === "Unassigned" ? t("cases.unassigned") : report.assignedInvestigator}
                </td>
                <td className="px-4 py-3 text-xs font-mono text-slate-500 whitespace-nowrap">{report.feedbackDue}</td>
                <td className="px-4 py-3 text-right">
                  <AppButton type="button" size="sm" variant="outline" onClick={() => navigate(`/cases/${report.id}`)}>
                    {t("common.open")}
                  </AppButton>
                </td>
              </tr>
            ))}
          </AppTable>
          <Pagination page={page} pageCount={pageCount} total={filtered.length} onChange={setPage} />
        </>
      )}
    </div>
  );
}
