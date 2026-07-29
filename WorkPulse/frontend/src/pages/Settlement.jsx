import { useEffect, useState, useCallback } from "react";
import * as api from "../api/workpulseApi";
import { PageHeader, Card, Spinner, ErrorBanner, Badge } from "../components/ui";
import { formatDuration, formatDate } from "../utils/format";

// Settlement reconciliation report (admin/HR).
//
// Shows, for the current settlement period, each employee's average weekly hours
// (checked against the 48h cap — art. 131) and their overtime so far this year
// (checked against the 150h cap — art. 151 §3). From each row an admin can open
// the "Protections" editor to set special-group flags (art. 178 / 203).
export default function Settlement() {
  const [rows, setRows] = useState([]);
  const [period, setPeriod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [onlyViolations, setOnlyViolations] = useState(false);
  const [editing, setEditing] = useState(null); // the row whose profile is open

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError("");
      const data = await api.getTenantSettlement(
        onlyViolations ? { onlyViolations: true } : {}
      );
      setRows(data || []);
      // All rows share the same period, so read it from the first row.
      if (data && data[0]) setPeriod({ start: data[0].periodStart, end: data[0].periodEnd });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [onlyViolations]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <PageHeader
        title="Settlement Reconciliation"
        subtitle="Okres rozliczeniowy — 48h weekly average (art. 131) & 150h/year overtime (art. 151 §3)"
      >
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={onlyViolations}
            onChange={(e) => setOnlyViolations(e.target.checked)}
            className="w-4 h-4 accent-indigo-600"
          />
          Only breaches
        </label>
      </PageHeader>

      <ErrorBanner message={error} />

      {period && (
        <p className="text-sm text-slate-500 mb-4">
          Current period: <span className="font-medium text-slate-700">{formatDate(period.start)}</span> →{" "}
          <span className="font-medium text-slate-700">{formatDate(period.end)}</span>
        </p>
      )}

      {loading ? (
        <Spinner label="Reconciling hours…" />
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-slate-500">
          {onlyViolations ? "No cap breaches this period. 🎉" : "No time entries in this period yet."}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Employee</th>
                  <th className="text-left font-medium px-4 py-3">Worked (period)</th>
                  <th className="text-left font-medium px-4 py-3">Avg weekly (≤48h)</th>
                  <th className="text-left font-medium px-4 py-3">Overtime (year, ≤150h)</th>
                  <th className="text-right font-medium px-4 py-3">Protections</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <SettlementRow key={r.userId} row={r} onEdit={() => setEditing(r)} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {editing && (
        <ProtectionsModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// One row of the reconciliation table, with cap badges.
function SettlementRow({ row, onEdit }) {
  const avgHours = (row.averageWeeklyMinutes / 60).toFixed(1);
  const annual = formatDuration(row.annualOvertimeMinutes);

  return (
    <tr className="hover:bg-slate-50/60">
      <td className="px-4 py-3">
        <p className="font-medium text-slate-800">{row.employeeName || "—"}</p>
      </td>
      <td className="px-4 py-3 text-slate-600">{formatDuration(row.workedMinutes)}</td>
      <td className="px-4 py-3">
        {row.exceedsWeeklyAverageCap ? (
          <Badge cls="bg-red-50 text-red-700 border-red-200">{avgHours}h — over 48h</Badge>
        ) : (
          <span className="text-slate-700">{avgHours}h</span>
        )}
      </td>
      <td className="px-4 py-3">
        {row.exceedsAnnualOvertimeLimit ? (
          <Badge cls="bg-red-50 text-red-700 border-red-200">{annual} — over limit</Badge>
        ) : row.approachingAnnualOvertimeLimit ? (
          <Badge cls="bg-amber-50 text-amber-700 border-amber-200">{annual} — near limit</Badge>
        ) : (
          <span className="text-slate-700">{annual}</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={onEdit}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
        >
          Edit
        </button>
      </td>
    </tr>
  );
}

// Modal to view/set an employee's special-group protection flags (art. 178/203).
function ProtectionsModal({ row, onClose, onSaved }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const p = await api.getEmployeeProfile(row.userId);
        // No profile yet → start from all-false defaults.
        setProfile(
          p || {
            isPregnant: false,
            isParentOfChildUnder4: false,
            isYoungWorker: false,
            consentToOvertime: false,
            consentToNightWork: false,
          }
        );
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [row.userId]);

  const set = (key, value) => setProfile((p) => ({ ...p, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await api.updateEmployeeProfile(row.userId, {
        isPregnant: !!profile.isPregnant,
        isParentOfChildUnder4: !!profile.isParentOfChildUnder4,
        isYoungWorker: !!profile.isYoungWorker,
        consentToOvertime: !!profile.consentToOvertime,
        consentToNightWork: !!profile.consentToNightWork,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const check = (key, label, hint) => (
    <label className="flex items-start gap-3 text-sm py-2">
      <input
        type="checkbox"
        checked={!!profile?.[key]}
        onChange={(e) => set(key, e.target.checked)}
        className="w-4 h-4 mt-0.5 accent-indigo-600"
      />
      <span>
        <span className="text-slate-800 font-medium">{label}</span>
        {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </span>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <Card className="w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Working-time protections</h3>
            <p className="text-sm text-slate-500">{row.employeeName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">
            ×
          </button>
        </div>

        <ErrorBanner message={error} />

        {loading ? (
          <Spinner label="Loading profile…" />
        ) : (
          <>
            <div className="divide-y divide-slate-100">
              {check("isPregnant", "Pregnant employee", "No overtime or night work (art. 178 §1)")}
              {check("isYoungWorker", "Young worker (młodociany)", "No overtime or night work (art. 203)")}
              {check(
                "isParentOfChildUnder4",
                "Parent of a child under 4",
                "Overtime / night work only with consent (art. 178 §2)"
              )}
            </div>

            <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-xs text-slate-500 mb-1 font-medium">Consent (for parent of a small child)</p>
              {check("consentToOvertime", "Agrees to overtime")}
              {check("consentToNightWork", "Agrees to night work")}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-sm font-semibold shadow hover:from-indigo-400 hover:to-blue-400 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
