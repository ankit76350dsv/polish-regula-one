import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchAuditLogs } from "../store/slices/auditSlice";
import { PageHeader, Card, Loader, AlertBanner, Badge, Button } from "../components/common";

// The set of actions we let the user filter by. Mirrors the backend actions.
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
];

// Picks a badge colour based on how sensitive the action is.
const actionTone = (action) => {
  if (action?.includes("CORRECTED") || action?.includes("UPDATED")) return "amber";
  if (action?.includes("GENERATED") || action?.includes("CREATED")) return "green";
  if (action?.includes("DOWNLOADED") || action?.includes("VIEWED")) return "blue";
  return "slate";
};

export default function AuditLogs() {
  const dispatch = useDispatch();
  const { logs, pagination, loading, error } = useSelector((state) => state.audit);

  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);

  // Reload whenever the filter or page changes.
  useEffect(() => {
    dispatch(fetchAuditLogs({ action: action || undefined, page, limit: 20 }));
  }, [dispatch, action, page]);

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        subtitle="Every important action is recorded here. Records are immutable and kept for 10 years."
        actions={
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Action</span>
            <select
              value={action}
              onChange={(e) => {
                setPage(1);
                setAction(e.target.value);
              }}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white"
            >
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a || "All actions"}
                </option>
              ))}
            </select>
          </label>
        }
      />

      {error && <AlertBanner level="error">{error}</AlertBanner>}

      {loading ? (
        <Loader label="Loading audit logs…" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Resource</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      No audit records found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log._id} className="border-b border-slate-100">
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={actionTone(log.action)}>{log.action}</Badge>
                      </td>
                      <td className="px-4 py-2.5">{log.userEmail || log.userId}</td>
                      <td className="px-4 py-2.5">
                        {log.resource}
                        {log.resourceId ? (
                          <span className="text-slate-400"> · {log.resourceId.slice(-6)}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400">{log.ipAddress || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 text-sm">
            <span className="text-slate-500">
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} records
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={pagination.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
