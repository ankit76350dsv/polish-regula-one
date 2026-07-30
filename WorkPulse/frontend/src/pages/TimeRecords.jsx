import { useEffect, useState, useCallback } from "react";
import * as api from "../api/workpulseApi";
import { PageHeader, Card, Spinner, ErrorBanner, Badge } from "../components/ui";
import {
  formatDuration,
  formatTime,
  formatDate,
  breakStatusMeta,
  entryStatusMeta,
} from "../utils/format";
import { useCapabilities } from "../hooks/useCapabilities";

// Convert a Date to the value a <input type="datetime-local"> expects.
function toLocalInput(value) {
  if (!value) return "";
  const d = new Date(value);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

// Every time entry in the tenant.
//
// Three different people open this page and must see three different things:
//   - an ADMIN or HR ADMIN can approve overtime and correct a wrong entry
//   - an AUDITOR can read every row and must be able to change NOTHING. Working
//     time records are the employer's legal evidence (Kodeks pracy art. 149); an
//     auditor who could edit them could create the very result they sign off.
// So the buttons below are tied to the ACTION they perform, not to a job title.
export default function TimeRecords() {
  // Reading the page (TIME_READ_ALL) is already checked by the router. Here we ask
  // the two narrower questions: may this person DECIDE overtime, and may they
  // CHANGE a stored record? They are separate permissions because they are
  // separate legal acts — approving overtime commits the employer (art. 151 §3),
  // while a correction rewrites evidence and always needs a written reason.
  const { can, CAPABILITIES } = useCapabilities();
  const canDecideOvertime = can(CAPABILITIES.OVERTIME_DECIDE);
  const canCorrect = can(CAPABILITIES.TIME_CORRECT);

  // With neither permission the whole "Actions" column is empty, so we drop the
  // column instead of showing a bare strip of white space.
  const showActions = canDecideOvertime || canCorrect;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ status: "All" });
  const [editing, setEditing] = useState(null); // entry being corrected

  const load = useCallback(async () => {
    try {
      setError("");
      const res = await api.listEntries({ status: filters.status, limit: 50 });
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters.status]);

  useEffect(() => {
    load();
  }, [load]);

  const decideOvertime = async (id, decision) => {
    try {
      await api.decideOvertime(id, { decision, reason: "MANUAL_HR_APPROVAL" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <Spinner label="Loading time records…" />;

  const entries = data?.entries || [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* The subtitle follows the permissions too, so a read-only viewer is not
          promised buttons they will never see. */}
      <PageHeader
        title="Time Records"
        subtitle={
          showActions
            ? "All working-time entries · overtime approval · corrections"
            : "All working-time entries · read-only view"
        }
      >
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
        >
          {["All", "OPEN", "ON_BREAK", "COMPLETED", "MISSING_CLOCK_OUT"].map((s) => (
            <option key={s} value={s}>
              {s}
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
                <th className="text-left px-4 py-3">Employee</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">In / Out</th>
                <th className="text-left px-4 py-3">Worked</th>
                <th className="text-left px-4 py-3">Break</th>
                <th className="text-left px-4 py-3">Overtime</th>
                <th className="text-left px-4 py-3">Status</th>
                {showActions && <th className="text-left px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.length === 0 && (
                <tr>
                  {/* 7 fixed columns, plus "Actions" only when it is shown. */}
                  <td colSpan={showActions ? 8 : 7} className="px-4 py-8 text-center text-slate-400">No records.</td>
                </tr>
              )}
              {entries.map((e) => {
                const bm = breakStatusMeta(e.breakComplianceStatus);
                const sm = entryStatusMeta(e.status);
                return (
                  <tr key={e._id} className="hover:bg-slate-50 align-top">
                    <td className="px-4 py-3 text-slate-700">
                      {e.employeeName || "—"}
                      {e.corrected && <span className="block text-[10px] text-amber-600">corrected</span>}
                      {e.dailyRest?.violation && (
                        <span className="block text-[10px] text-red-600">rest &lt;11h</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{formatDate(e.workDate)}</td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                      {formatTime(e.clockIn)} – {formatTime(e.clockOut)}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold">{formatDuration(e.netWorkedMinutes)}</td>
                    <td className="px-4 py-3"><Badge cls={bm.cls}>{bm.label}</Badge></td>
                    <td className="px-4 py-3 tabular-nums">
                      {e.overtimeMinutes > 0 ? (
                        <div>
                          <span className="text-amber-600 font-medium">{formatDuration(e.overtimeMinutes)}</span>
                          <span className="block text-[10px] text-slate-400">{e.approvalStatus}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><Badge cls={sm.cls}>{sm.label}</Badge></td>
                    {showActions && (
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          {/* Approve / Reject overtime — only for someone who may
                              decide it. Still only shown while a decision is
                              actually waiting. */}
                          {canDecideOvertime && e.overtimeMinutes > 0 && e.approvalStatus === "PENDING" && (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => decideOvertime(e._id, "APPROVE")}
                                className="px-2 py-1 rounded-lg bg-emerald-500 text-white text-xs hover:bg-emerald-400"
                              >
                                Approve OT
                              </button>
                              <button
                                onClick={() => decideOvertime(e._id, "REJECT")}
                                className="px-2 py-1 rounded-lg bg-red-500 text-white text-xs hover:bg-red-400"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                          {/* Correcting a record rewrites legal evidence, so it is
                              its own permission. */}
                          {canCorrect && (
                            <button
                              onClick={() => setEditing(e)}
                              className="px-2 py-1 rounded-lg border border-slate-300 text-slate-600 text-xs hover:bg-slate-50"
                            >
                              Correct
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* `canCorrect` is checked again here, not only on the button. If a later
          change ever sets `editing` from somewhere else, the form still cannot
          open for someone who may not correct records. */}
      {editing && canCorrect && (
        <CorrectionModal
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

// Modal for a manual correction. A reason is mandatory — the backend rejects an
// edit without one, so the evidence trail always explains why a record changed.
function CorrectionModal({ entry, onClose, onSaved, onError }) {
  const [clockIn, setClockIn] = useState(toLocalInput(entry.clockIn));
  const [clockOut, setClockOut] = useState(toLocalInput(entry.clockOut));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!reason.trim()) {
      onError("A correction reason is required.");
      return;
    }
    setSaving(true);
    try {
      await api.correctEntry(entry._id, {
        clockIn: clockIn ? new Date(clockIn).toISOString() : undefined,
        clockOut: clockOut ? new Date(clockOut).toISOString() : null,
        correctionReason: reason,
      });
      await onSaved();
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6">
        <h2 className="font-bold text-slate-900 text-lg mb-1">Correct time entry</h2>
        <p className="text-xs text-slate-500 mb-4">
          {entry.employeeName} · {formatDate(entry.workDate)}
        </p>

        <label className="block text-sm mb-3">
          <span className="text-slate-500">Clock in</span>
          <input
            type="datetime-local"
            value={clockIn}
            onChange={(e) => setClockIn(e.target.value)}
            className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-400 outline-none"
          />
        </label>
        <label className="block text-sm mb-3">
          <span className="text-slate-500">Clock out</span>
          <input
            type="datetime-local"
            value={clockOut}
            onChange={(e) => setClockOut(e.target.value)}
            className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-400 outline-none"
          />
        </label>
        <label className="block text-sm mb-4">
          <span className="text-slate-500">Reason (required)</span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. employee forgot to clock out"
            className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-400 outline-none"
          />
        </label>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 text-sm hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save correction"}
          </button>
        </div>
      </Card>
    </div>
  );
}
