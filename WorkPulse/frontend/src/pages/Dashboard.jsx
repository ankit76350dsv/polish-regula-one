import { useEffect, useState } from "react";
import * as api from "../api/workpulseApi";
import { PageHeader, Card, StatCard, Spinner, ErrorBanner, Badge } from "../components/ui";
import { formatTime, formatDateTime, entryStatusMeta } from "../utils/format";

// Admin/HR dashboard — a live snapshot of the tenant's working time today
// plus last-7-days compliance totals.
export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getOverview();
        setData(res);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Spinner label="Loading dashboard…" />;

  const m = data?.metrics || {};
  const w = data?.weeklyTotals || {};

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <PageHeader title="Dashboard" subtitle="Live working-time overview for your organisation" />
      <ErrorBanner message={error} />

      {/* Live metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Clocked in now" value={m.clockedInNow ?? 0} tone="indigo" />
        <StatCard label="On break" value={m.onBreakNow ?? 0} tone="amber" />
        <StatCard label="Completed today" value={m.completedToday ?? 0} tone="emerald" />
        <StatCard
          label="Missing clock-out"
          value={m.missingClockOut ?? 0}
          tone={m.missingClockOut ? "red" : "slate"}
        />
      </div>

      {/* Approvals + weekly compliance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <h2 className="font-semibold text-slate-800 mb-3">Needs attention</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-3xl font-extrabold text-amber-600">{m.pendingOvertime ?? 0}</p>
              <p className="text-xs text-slate-500 mt-1">Overtime awaiting approval</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-amber-600">{m.pendingAbsences ?? 0}</p>
              <p className="text-xs text-slate-500 mt-1">Absence requests pending</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-800 mb-3">Last 7 days</h2>
          <div className="grid grid-cols-2 gap-y-3 text-sm">
            <span className="text-slate-500">Worked hours</span>
            <span className="font-semibold text-right">{w.workedHours ?? 0}h</span>
            <span className="text-slate-500">Overtime hours</span>
            <span className="font-semibold text-right">{w.overtimeHours ?? 0}h</span>
            <span className="text-slate-500">Missing breaks</span>
            <span className={`font-semibold text-right ${w.missingBreak ? "text-red-600" : ""}`}>{w.missingBreak ?? 0}</span>
            <span className="text-slate-500">Short breaks</span>
            <span className={`font-semibold text-right ${w.shortBreak ? "text-amber-600" : ""}`}>{w.shortBreak ?? 0}</span>
            <span className="text-slate-500">Rest violations (11h)</span>
            <span className={`font-semibold text-right ${w.restViolations ? "text-red-600" : ""}`}>{w.restViolations ?? 0}</span>
          </div>
        </Card>
      </div>

      {/* Today's activity */}
      <Card className="overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-slate-100 font-semibold text-slate-800">Today's entries</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Employee</th>
                <th className="text-left px-4 py-3">In</th>
                <th className="text-left px-4 py-3">Out</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.todayEntries || []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">No activity today.</td>
                </tr>
              )}
              {(data?.todayEntries || []).map((e) => {
                const sm = entryStatusMeta(e.status);
                return (
                  <tr key={e._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{e.employeeName || "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{formatTime(e.clockIn)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatTime(e.clockOut)}</td>
                    <td className="px-4 py-3"><Badge cls={sm.cls}>{sm.label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Recent activity timeline */}
      <Card className="p-5">
        <h2 className="font-semibold text-slate-800 mb-3">Recent activity</h2>
        <ul className="space-y-2">
          {(data?.recentActivity || []).length === 0 && (
            <li className="text-slate-400 text-sm">No recent activity.</li>
          )}
          {(data?.recentActivity || []).map((a) => (
            <li key={a.id} className="flex items-center justify-between text-sm border-b border-slate-50 pb-2">
              <span className="text-slate-700">
                <span className="font-medium">{a.who}</span> {a.what}
                {!a.success && <span className="text-red-500"> (blocked)</span>}
              </span>
              <span className="text-slate-400 text-xs">{formatDateTime(a.when)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
