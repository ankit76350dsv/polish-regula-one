import { useEffect, useState } from "react";
import * as api from "../api/workpulseApi";
import { PageHeader, Card, Spinner, ErrorBanner, Badge } from "../components/ui";
import { formatDuration, formatTime, formatDate, breakStatusMeta, entryStatusMeta } from "../utils/format";

// The logged-in employee's own working-time history (read-only).
export default function MyTimesheet() {
  const [data, setData] = useState(null);
  const [settlement, setSettlement] = useState(null); // my period + yearly picture
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [res, s] = await Promise.all([
          api.getMyEntries({ limit: 60 }),
          api.getMySettlement().catch(() => null),
        ]);
        setData(res);
        setSettlement(s);
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

      {/* My working-time compliance this settlement period (art. 131 / 151 §3). */}
      {settlement && <MyComplianceCard s={settlement} />}

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

// A compact card showing the employee's own settlement-period compliance:
// average weekly hours (vs the 48h cap) and overtime used this year (vs 150h).
function MyComplianceCard({ s }) {
  const avgHours = (s.averageWeeklyMinutes / 60).toFixed(1);
  const annualHours = (s.annualOvertimeMinutes / 60).toFixed(1);
  const limitHours = (s.annualOvertimeLimitMinutes / 60).toFixed(0);
  const maxAvg = (s.maxAverageWeeklyMinutes / 60).toFixed(0);

  return (
    <Card className="p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-700">My compliance this period</p>
        {s.exceedsWeeklyAverageCap || s.exceedsAnnualOvertimeLimit ? (
          <Badge cls="bg-red-50 text-red-700 border-red-200">Attention needed</Badge>
        ) : s.approachingAnnualOvertimeLimit ? (
          <Badge cls="bg-amber-50 text-amber-700 border-amber-200">Near yearly limit</Badge>
        ) : (
          <Badge cls="bg-emerald-50 text-emerald-700 border-emerald-200">Within limits</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Average weekly hours</p>
          <p className={`text-xl font-extrabold mt-1 ${s.exceedsWeeklyAverageCap ? "text-red-600" : "text-slate-800"}`}>
            {avgHours}h <span className="text-xs font-medium text-slate-400">/ {maxAvg}h cap</span>
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Overtime this year</p>
          <p
            className={`text-xl font-extrabold mt-1 ${
              s.exceedsAnnualOvertimeLimit ? "text-red-600" : s.approachingAnnualOvertimeLimit ? "text-amber-600" : "text-slate-800"
            }`}
          >
            {annualHours}h <span className="text-xs font-medium text-slate-400">/ {limitHours}h limit</span>
          </p>
        </div>
      </div>
    </Card>
  );
}
