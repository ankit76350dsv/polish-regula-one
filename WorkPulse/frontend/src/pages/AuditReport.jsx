import { useEffect, useState, useCallback } from "react";
import * as api from "../api/workpulseApi";
import { PageHeader, Card, Spinner, ErrorBanner, Badge } from "../components/ui";
import { formatDateTime } from "../utils/format";

const ACTIONS = [
  "All",
  "CLOCK_IN",
  "CLOCK_OUT",
  "CLOCK_IN_BLOCKED",
  "BREAK_START",
  "BREAK_END",
  "ENTRY_CORRECTED",
  "OVERTIME_APPROVED",
  "OVERTIME_REJECTED",
  "ABSENCE_CREATED",
  "ABSENCE_DECISION",
  "POLICY_UPDATED",
  "MISSING_CLOCK_OUT_FLAGGED",
];

// Read-only view of the immutable WorkPulse audit trail (workplus_auditlogs).
export default function AuditReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState("All");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try {
      setError("");
      const res = await api.getAuditLogs({ action, page, limit: 25 });
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [action, page]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Spinner label="Loading audit trail…" />;

  const logs = data?.logs || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1 };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <PageHeader title="Audit Trail" subtitle="Immutable record of every working-time action (10-year retention)">
        <select
          value={action}
          onChange={(e) => {
            setPage(1);
            setAction(e.target.value);
          }}
          className="border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
        >
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </PageHeader>

      <ErrorBanner message={error} />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">When</th>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Action</th>
                <th className="text-left px-4 py-3">Resource</th>
                <th className="text-left px-4 py-3">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">No audit entries.</td>
                </tr>
              )}
              {logs.map((l) => (
                <tr key={l._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-700">{l.userEmail || l.userId}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{l.action}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {l.resource}
                    {l.resourceId && <span className="text-[10px] block text-slate-400">{l.resourceId}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {l.success ? (
                      <Badge cls="bg-emerald-50 text-emerald-700 border-emerald-200">OK</Badge>
                    ) : (
                      <Badge cls="bg-red-50 text-red-700 border-red-200">Blocked</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm">
          <span className="text-slate-500">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
            >
              Previous
            </button>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
