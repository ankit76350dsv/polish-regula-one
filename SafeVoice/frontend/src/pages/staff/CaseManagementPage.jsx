import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { AppButton, AppTable, EmptyState, ErrorState, PageSpinner, Pagination, SeverityBadge, StatusBadge } from "../../components/ui";
import { fetchCasePage, selectRegister } from "../../slices/reportsSlice";
import { fetchUsers, selectUsers } from "../../slices/usersSlice";

const PAGE_SIZE = 8;
const FILTERS = ["all", "critical", "unassigned", "feedbackDue"];

export default function CaseManagementPage({ navigate }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  // The register is now a SERVER-side page: the backend does the search, filter and
  // paging, and returns just this page of rows plus the totals for the pager.
  const register = useSelector(selectRegister);
  // The register rows store the investigator as a user id; we resolve it to a name
  // for display using the tenant's user list (which carries id + name).
  const users = useSelector(selectUsers);
  const userNameById = useMemo(
    () => Object.fromEntries((users || []).map((u) => [u.id, u.name])),
    [users],
  );

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Debounce the search box so we ask the server only after the user pauses typing
  // (300ms), instead of firing a request on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  // Fetch whenever the page, the (debounced) search, or the filter changes.
  useEffect(() => {
    dispatch(fetchCasePage({ page, size: PAGE_SIZE, search: debouncedQuery, filter }));
  }, [dispatch, page, debouncedQuery, filter]);

  // Load the tenant's users once so we can show investigator names, not raw ids.
  useEffect(() => {
    if (users.length === 0) dispatch(fetchUsers());
  }, [users.length, dispatch]);

  // Changing the search or filter always restarts at page 1 (so we never land on a
  // page that no longer exists for the new, smaller result set).
  const onSearchChange = (value) => {
    setQuery(value);
    setPage(1);
  };
  const onFilterChange = (value) => {
    setFilter(value);
    setPage(1);
  };

  const { items, total, totalPages, status } = register;

  if (status === "loading" && items.length === 0) return <PageSpinner label={t("common.loading")} />;
  if (status === "failed") {
    return (
      <ErrorState
        message={t("cases.loadError")}
        onRetry={() => dispatch(fetchCasePage({ page, size: PAGE_SIZE, search: debouncedQuery, filter }))}
      />
    );
  }

  return (
    <div className="w-full min-w-0 space-y-5 leading-relaxed">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">{t("cases.title")}</h1>
          <p className="text-xs text-slate-500 mt-1">{t("cases.subtitle")}</p>
        </div>
      </div>

      <div className="flex min-w-0 flex-col md:flex-row md:items-center gap-4 bg-white p-4 rounded-lg border border-slate-200 justify-between shadow-xs">
        <div className="relative w-full md:max-w-sm">
          <label htmlFor="case-search" className="sr-only">{t("common.search")}</label>
          <input
            id="case-search"
            type="search"
            value={query}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("cases.searchPlaceholder")}
            className="w-full bg-slate-50 border border-slate-300 text-slate-800 rounded-lg py-2 pl-9 pr-4 text-xs font-semibold outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-wrap gap-2 text-xs" role="group" aria-label={t("common.filter")}>
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => onFilterChange(f)}
              className={`rounded-lg border px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                filter === f ? "border-cyan-300 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
              }`}
            >
              {t(`cases.filter${f.charAt(0).toUpperCase() + f.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState title={t("cases.empty")} />
      ) : (
        <div className="min-w-0">
          <AppTable
            className="min-w-0"
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
            {items.map((report) => (
              <tr key={report.id} className="hover:bg-slate-50 border-b border-slate-200 transition-colors">
                <td className="px-4 py-3 text-xs">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900 break-all">{report.caseReference || report.id}</span>
                    {report.unreadCount > 0 && (
                      <span
                        className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-rose-600 text-white text-[10px] font-bold shrink-0"
                        title={t("cases.unreadMessages", { count: report.unreadCount })}
                        aria-label={t("cases.unreadMessages", { count: report.unreadCount })}
                      >
                        {report.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{report.disclosureMode}</div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-700 break-words">{t(`categories.${report.category}`, report.category)}</td>
                <td className="px-4 py-3 text-xs"><StatusBadge status={report.status} /></td>
                <td className="px-4 py-3 text-xs"><SeverityBadge severity={report.severity} /></td>
                <td className="px-4 py-3 text-xs text-slate-700 break-words">
                  {report.assignedInvestigator === "Unassigned" || !report.assignedInvestigator
                    ? t("cases.unassigned")
                    : userNameById[report.assignedInvestigator] || report.assignedInvestigator}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{report.feedbackDue}</td>
                <td className="px-4 py-3 text-right">
                  <AppButton type="button" size="sm" variant="outline" onClick={() => navigate(`/cases/${report.id}`)}>
                    {t("common.open")}
                  </AppButton>
                </td>
              </tr>
            ))}
          </AppTable>
          <Pagination page={page} pageCount={totalPages || 1} total={total} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
