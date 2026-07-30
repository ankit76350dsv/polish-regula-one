import { useEffect, useState, useCallback } from "react";
import * as api from "../api/workpulseApi";
import { PageHeader, Card, Spinner, ErrorBanner, Badge } from "../components/ui";
import { formatDate, ABSENCE_TYPE_LABELS } from "../utils/format";
import { useCapabilities } from "../hooks/useCapabilities";

const STATUS_META = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-slate-100 text-slate-500 border-slate-200",
};

export default function Absences() {
  // The hook reads the signed-in user from Redux itself, so this page does not
  // need its own copy of the user object.
  const { can, CAPABILITIES } = useCapabilities();

  // Three separate questions, because three different people open this page:
  //
  //   canRequestOwn  — may I ask for MY OWN leave and see my own requests?
  //                    A worker, HR and an admin can. An AUDITOR cannot: they do not
  //                    take leave through this module, they only inspect it.
  //   canReviewAll   — may I see EVERYBODY's requests? (HR, admin, auditor)
  //   canDecide      — may I approve or reject one? (HR, admin — never an auditor,
  //                    because an auditor who could decide would be checking their
  //                    own decisions.)
  //
  // These are asked separately on purpose. Reading every absence and deciding on
  // one are different acts, and a job title cannot express the difference.
  const canRequestOwn = can(CAPABILITIES.ABSENCE_SELF);
  const canReviewAll = can(CAPABILITIES.ABSENCE_READ_ALL);
  const canDecide = can(CAPABILITIES.ABSENCE_DECIDE);

  const [mine, setMine] = useState([]);
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ type: "ANNUAL_LEAVE", startDate: "", endDate: "", reason: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");

      // Ask ONLY for the lists this person is allowed to have.
      //
      // Previously "my absences" was always requested. That broke the page for an
      // auditor: they may read everybody's absences but have no absences of their
      // own to read, so the call came back refused and Promise.all threw — leaving
      // them with an error message and no data at all, even though the list they
      // are entitled to had loaded fine.
      const [m, a] = await Promise.all([
        canRequestOwn ? api.getMyAbsences() : Promise.resolve([]),
        canReviewAll ? api.listAbsences() : Promise.resolve([]),
      ]);

      setMine(m || []);
      setAll(a || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [canRequestOwn, canReviewAll]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    // Guarded here too, not only by hiding the form.
    if (!canRequestOwn) return;
    if (!form.startDate || !form.endDate) {
      setError("Please choose a start and end date.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.createAbsence(form);
      setForm({ type: "ANNUAL_LEAVE", startDate: "", endDate: "", reason: "" });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const decide = async (id, status) => {
    try {
      await api.decideAbsence(id, status);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <PageHeader title="Absences" subtitle="Leave, sickness and other non-working days" />
      <ErrorBanner message={error} />

      {/* Request form — only for someone who books their own leave here.
          An auditor gets straight to the lists below. */}
      {canRequestOwn && (
      <Card className="p-5 mb-6">
        <h2 className="font-semibold text-slate-800 mb-4">Request an absence</h2>
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="text-sm">
            <span className="text-slate-500">Type</span>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-400 outline-none"
            >
              {Object.entries(ABSENCE_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="text-slate-500">Start</span>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-400 outline-none"
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-500">End</span>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-400 outline-none"
              />
            </label>
          </div>
          <label className="text-sm sm:col-span-2">
            <span className="text-slate-500">Reason (optional)</span>
            <input
              type="text"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-400 outline-none"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-semibold shadow hover:from-indigo-400 hover:to-blue-400 active:scale-95 disabled:opacity-50"
            >
              {saving ? "Submitting…" : "Submit request"}
            </button>
          </div>
        </form>
      </Card>
      )}

      {/* My own absences — same rule as the form above. */}
      {canRequestOwn && <AbsenceTable title="My absences" rows={mine} />}

      {/* Everyone's absences. Shown to HR, admins and auditors.
          The Approve / Reject buttons appear only for people who may actually
          decide — an auditor sees the same list read-only. */}
      {canReviewAll && (
        <AbsenceTable
          title="All absences"
          rows={all}
          showEmployee
          onDecide={canDecide ? decide : undefined}
          // No gap needed when this is the only table on the page (an auditor).
          className={canRequestOwn ? "mt-6" : ""}
        />
      )}
    </div>
  );
}

// `showEmployee` adds the "Employee" column (whose absence is this?).
// `onDecide`     adds the Approve / Reject buttons.
// They are separate props because reading and deciding are separate permissions.
function AbsenceTable({ title, rows, showEmployee = false, onDecide, className = "" }) {
  return (
    <Card className={`overflow-hidden ${className}`}>
      <div className="px-5 py-3 border-b border-slate-100 font-semibold text-slate-800">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              {showEmployee && <th className="text-left px-4 py-3">Employee</th>}
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">From</th>
              <th className="text-left px-4 py-3">To</th>
              <th className="text-left px-4 py-3">Days</th>
              <th className="text-left px-4 py-3">Status</th>
              {onDecide && <th className="text-left px-4 py-3">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5 + (showEmployee ? 1 : 0) + (onDecide ? 1 : 0)} className="px-4 py-8 text-center text-slate-400">
                  No absences.
                </td>
              </tr>
            )}
            {rows.map((a) => (
              <tr key={a._id} className="hover:bg-slate-50">
                {showEmployee && <td className="px-4 py-3 text-slate-700">{a.employeeName || "—"}</td>}
                <td className="px-4 py-3 text-slate-700">{ABSENCE_TYPE_LABELS[a.type] || a.type}</td>
                <td className="px-4 py-3">{formatDate(a.startDate)}</td>
                <td className="px-4 py-3">{formatDate(a.endDate)}</td>
                <td className="px-4 py-3 tabular-nums">{a.workingDays}</td>
                <td className="px-4 py-3">
                  <Badge cls={STATUS_META[a.status]}>{a.status}</Badge>
                </td>
                {onDecide && (
                  <td className="px-4 py-3">
                    {a.status === "PENDING" ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => onDecide(a._id, "APPROVED")}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-400"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => onDecide(a._id, "REJECTED")}
                          className="px-2.5 py-1 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-400"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
