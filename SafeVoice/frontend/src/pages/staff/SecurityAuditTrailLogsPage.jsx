import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { ChevronRight, Download, Search } from "lucide-react";
import { AppButton, AppTable, ConfirmDialog, EmptyState, ErrorState, PageSpinner } from "../../components/ui";
import { fetchAudit, selectAuditLogs, selectAuditStatus } from "../../slices/auditSlice";
import { addToast } from "../../slices/uiSlice";

export default function SecurityAuditTrailLogsPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const logs = useSelector(selectAuditLogs);
  const status = useSelector(selectAuditStatus);
  const [query, setQuery] = useState("");
  const [confirmExport, setConfirmExport] = useState(false);

  useEffect(() => {
    if (status === "idle") dispatch(fetchAudit());
  }, [status, dispatch]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) =>
      [l.actorRole, l.actorRef, l.actionType, l.subjectId, l.outcome].join(" ").toLowerCase().includes(q),
    );
  }, [logs, query]);

  if (status === "loading" && logs.length === 0) return <PageSpinner label={t("common.loading")} />;
  if (status === "failed") return <ErrorState onRetry={() => dispatch(fetchAudit())} />;

  return (
    <div className="space-y-6 max-w-6xl mx-auto leading-relaxed">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">{t("audit.title")}</h1>
          <p className="text-xs text-slate-500 mt-1">{t("audit.subtitle")}</p>
        </div>
        <AppButton type="button" variant="outline" icon={<Download className="w-4 h-4" />} onClick={() => setConfirmExport(true)}>
          {t("audit.export")}
        </AppButton>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-lg border border-slate-200 justify-between shadow-xs">
        <div className="relative w-full md:max-w-xs">
          <label htmlFor="audit-search" className="sr-only">{t("common.search")}</label>
          <input
            id="audit-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("audit.searchPlaceholder")}
            className="w-full bg-slate-50 border border-slate-300 text-slate-800 rounded-lg py-2 pl-9 pr-4 text-xs font-semibold outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" aria-hidden="true" />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 p-2 rounded">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" aria-hidden="true" />
          <span className="font-mono text-[10px] text-slate-700">{t("audit.worm")}</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={t("audit.empty")} />
      ) : (
        <AppTable headers={[t("audit.colTime"), t("audit.colActor"), t("audit.colAction"), t("audit.colSubject"), t("audit.colOutcome"), t("audit.colMetadata"), t("audit.colSeal")]}>
          {filtered.map((log) => (
            <tr key={log.id} className="hover:bg-slate-50 border-b border-slate-200 transition-colors">
              <td className="px-4 py-3 text-xs font-mono text-slate-500 whitespace-nowrap">{log.timestamp}</td>
              <td className="px-4 py-3 text-xs text-slate-800">
                <div className="font-bold">{log.actorRole}</div>
                <div className="text-[10px] text-slate-500 font-mono">{log.actorRef}</div>
              </td>
              <td className="px-4 py-3 text-xs text-slate-700">{log.actionType}</td>
              <td className="px-4 py-3 text-xs font-mono text-slate-500">{log.subjectId}</td>
              <td className="px-4 py-3 text-xs text-emerald-700 font-semibold">{log.outcome}</td>
              <td className="px-4 py-3 text-xs text-slate-500 max-w-sm">
                {log.metadataNotice}
                {log.oldValue && log.newValue && (
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                    <span>{log.oldValue}</span>
                    <ChevronRight className="w-3 h-3" aria-hidden="true" />
                    <span className="text-cyan-700">{log.newValue}</span>
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-xs font-mono text-slate-400">{log.hashChain}</td>
            </tr>
          ))}
        </AppTable>
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
