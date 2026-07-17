import { useEffect, useState } from "react";
import * as api from "../api/workpulseApi";
import { PageHeader, Card, Spinner, ErrorBanner, Badge } from "../components/ui";
import { formatDuration, formatTime, formatDate, breakStatusMeta, entryStatusMeta } from "../utils/format";

// The logged-in employee's own working-time history (read-only).
export default function MyTimesheet() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getMyEntries({ limit: 60 });
        setData(res);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Spinner />;

  const entries = data?.entries || [];

  // Totals across the loaded page for a quick personal summary.
  const totals = entries.reduce(
    (acc, e) => {
      acc.worked += e.netWorkedMinutes || 0;
      acc.overtime += e.overtimeMinutes || 0;
      return acc;
    },
    { worked: 0, overtime: 0 }
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <PageHeader title="My Timesheet" subtitle="Your recorded working time and breaks" />
      <ErrorBanner message={error} />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Days shown</p>
          <p className="text-2xl font-extrabold text-slate-800 mt-1">{entries.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Total worked</p>
          <p className="text-2xl font-extrabold text-indigo-700 mt-1">{formatDuration(totals.worked)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Total overtime</p>
          <p className="text-2xl font-extrabold text-amber-600 mt-1">{formatDuration(totals.overtime)}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">In</th>
                <th className="text-left px-4 py-3">Out</th>
                <th className="text-left px-4 py-3">Worked</th>
                <th className="text-left px-4 py-3">Break</th>
                <th className="text-left px-4 py-3">Overtime</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No time entries yet. Clock in from the Clock screen to start.
                  </td>
                </tr>
              )}
              {entries.map((e) => {
                const bm = breakStatusMeta(e.breakComplianceStatus);
                const sm = entryStatusMeta(e.status);
                return (
                  <tr key={e._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">{formatDate(e.workDate)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatTime(e.clockIn)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatTime(e.clockOut)}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold">{formatDuration(e.netWorkedMinutes)}</td>
                    <td className="px-4 py-3">
                      <Badge cls={bm.cls}>{bm.label}</Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {e.overtimeMinutes > 0 ? (
                        <span className="text-amber-600 font-medium">
                          {formatDuration(e.overtimeMinutes)}
                          {e.approvalStatus === "PENDING" && <span className="text-xs"> (pending)</span>}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge cls={sm.cls}>{sm.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
