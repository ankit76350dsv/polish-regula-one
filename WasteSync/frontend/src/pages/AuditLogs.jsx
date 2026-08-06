import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchAuditLogs } from "../store/slices/auditSlice";
import { PageHeader, Card, Loader, AlertBanner, Badge, Button } from "../components/common";
import { useTranslation } from "../hooks/useTranslation";

// The set of actions we let the user filter by. Mirrors the backend actions.
//
// These are CODES, not words. They are sent to the API as-is and they are what the
// audit table shows. The friendly, translated wording used in the filter dropdown
// lives in the language files under `audit.actionNames`.
const ACTIONS = [
  "",
  "LOGIN",
  "LOGOUT",
  "COMPANY_CREATED",
  "COMPANY_UPDATED",
  "WASTE_ENTRY_CREATED",
  "WASTE_ENTRY_CORRECTED",
  "REPORT_GENERATED",
  "REPORT_DOWNLOADED",
  "REPORT_SUBMITTED",
  // A request that was REFUSED because the caller was not allowed to make it.
  // Worth filtering on its own: one entry is usually somebody clicking a stale
  // link, but a burst of them is how you spot someone probing the API.
  "ACCESS_DENIED",
];

// Picks a badge colour based on how sensitive the action is.
const actionTone = (action) => {
  // Refusals first — a red badge makes them stand out in a long list.
  if (action === "ACCESS_DENIED") return "red";
  if (action?.includes("CORRECTED") || action?.includes("UPDATED")) return "amber";
  if (action?.includes("GENERATED") || action?.includes("CREATED")) return "green";
  if (action?.includes("DOWNLOADED") || action?.includes("VIEWED")) return "blue";
  return "slate";
};

export default function AuditLogs() {
  const dispatch = useDispatch();
  const { logs, pagination, loading, error } = useSelector((state) => state.audit);

  // Words and date formatting for the chosen language (Polish by default).
  const { t, formatDateTime } = useTranslation();

  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);

  // Reload whenever the filter or page changes.
  useEffect(() => {
    dispatch(fetchAuditLogs({ action: action || undefined, page, limit: 20 }));
  }, [dispatch, action, page]);

  return (
    <div>
      <PageHeader
        title={t("audit.title")}
        subtitle={t("audit.subtitle")}
        actions={
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">{t("audit.filterLabel")}</span>
            <select
              value={action}
              onChange={(e) => {
                setPage(1);
                setAction(e.target.value);
              }}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white"
            >
              {ACTIONS.map((a) => (
                // The VALUE stays the raw code (that is what the API filters on);
                // only the text the person reads is translated. The empty code means
                // "no filter", so it gets the "all actions" wording.
                <option key={a} value={a}>
                  {a ? t(`audit.actionNames.${a}`) : t("audit.allActions")}
                </option>
              ))}
            </select>
          </label>
        }
      />

      {error && <AlertBanner level="error">{error}</AlertBanner>}

      {loading ? (
        <Loader label={t("audit.loading")} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-3 font-medium">{t("audit.table.when")}</th>
                  <th className="px-4 py-3 font-medium">{t("audit.table.action")}</th>
                  <th className="px-4 py-3 font-medium">{t("audit.table.user")}</th>
                  <th className="px-4 py-3 font-medium">{t("audit.table.resource")}</th>
                  <th className="px-4 py-3 font-medium">{t("audit.table.ip")}</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      {t("audit.none")}
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log._id} className="border-b border-slate-100">
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        {/* The stored action CODE, shown exactly as recorded and never
                            translated. This table IS the audit evidence: an inspector
                            comparing it against an export must find the same word, so
                            the wording must not depend on which language the person
                            reading happened to pick. */}
                        <Badge tone={actionTone(log.action)}>{log.action}</Badge>
                      </td>
                      <td className="px-4 py-2.5">{log.userEmail || log.userId}</td>
                      <td className="px-4 py-2.5">
                        {log.resource}
                        {log.resourceId ? (
                          <span className="text-slate-400"> · {log.resourceId.slice(-6)}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400">
                        {log.ipAddress || t("common.empty")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 text-sm">
            <span className="text-slate-500">
              {t("audit.pagination", {
                page: pagination.page,
                totalPages: pagination.totalPages,
                total: pagination.total,
              })}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={pagination.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t("common.previous")}
              </Button>
              <Button
                variant="secondary"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("common.next")}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
