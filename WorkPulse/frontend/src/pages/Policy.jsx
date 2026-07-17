import { useEffect, useState } from "react";
import * as api from "../api/workpulseApi";
import { PageHeader, Card, Spinner, ErrorBanner } from "../components/ui";

const SYSTEMS = [
  ["STANDARD", "Standard (podstawowy) — 8h/day, 40h/week"],
  ["EQUIVALENT", "Equivalent (równoważny)"],
  ["TASK_BASED", "Task-based (zadaniowy)"],
  ["SHORTENED_WEEK", "Shortened week (skrócony tydzień)"],
  ["WEEKEND_WORK", "Weekend work (weekendowy)"],
  ["FLEXIBLE", "Flexible (ruchomy)"],
  ["INDIVIDUAL", "Individual schedule (indywidualny)"],
];

// The tenant's Working Time Policy. Read by everyone, editable by admins.
export default function Policy() {
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setPolicy(await api.getPolicy());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (key, value) => setPolicy((p) => ({ ...p, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await api.updatePolicy({
        name: policy.name,
        workingTimeSystem: policy.workingTimeSystem,
        standardDailyHours: Number(policy.standardDailyHours),
        standardWeeklyHours: Number(policy.standardWeeklyHours),
        workDaysPerWeek: Number(policy.workDaysPerWeek),
        settlementPeriodMonths: Number(policy.settlementPeriodMonths),
        overtimeRequiresApproval: policy.overtimeRequiresApproval,
        dailyRestHours: Number(policy.dailyRestHours),
        weeklyRestHours: Number(policy.weeklyRestHours),
      });
      setPolicy(updated);
      setMessage("Policy saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;
  if (!policy) return <ErrorBanner message={error || "No policy"} />;

  const field = "mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-400 outline-none";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <PageHeader title="Working Time Policy" subtitle="Regulamin czasu pracy — the rules the engine applies" />
      <ErrorBanner message={error} />
      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3 mb-4">
          {message}
        </div>
      )}

      <Card className="p-6 space-y-5">
        <label className="block text-sm">
          <span className="text-slate-500">Working-time system</span>
          <select value={policy.workingTimeSystem} onChange={(e) => set("workingTimeSystem", e.target.value)} className={field}>
            {SYSTEMS.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="block text-sm">
            <span className="text-slate-500">Daily norm (hours)</span>
            <input type="number" min="1" max="24" step="0.5" value={policy.standardDailyHours} onChange={(e) => set("standardDailyHours", e.target.value)} className={field} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">Weekly norm (hours)</span>
            <input type="number" min="1" max="168" value={policy.standardWeeklyHours} onChange={(e) => set("standardWeeklyHours", e.target.value)} className={field} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">Work days / week</span>
            <input type="number" min="1" max="7" value={policy.workDaysPerWeek} onChange={(e) => set("workDaysPerWeek", e.target.value)} className={field} />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="block text-sm">
            <span className="text-slate-500">Settlement period (months)</span>
            <input type="number" min="1" max="12" value={policy.settlementPeriodMonths} onChange={(e) => set("settlementPeriodMonths", e.target.value)} className={field} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">Daily rest (hours)</span>
            <input type="number" min="1" max="24" value={policy.dailyRestHours} onChange={(e) => set("dailyRestHours", e.target.value)} className={field} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">Weekly rest (hours)</span>
            <input type="number" min="1" max="168" value={policy.weeklyRestHours} onChange={(e) => set("weeklyRestHours", e.target.value)} className={field} />
          </label>
        </div>

        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={!!policy.overtimeRequiresApproval}
            onChange={(e) => set("overtimeRequiresApproval", e.target.checked)}
            className="w-4 h-4 accent-indigo-600"
          />
          <span className="text-slate-700">Overtime must be approved by a manager before it counts</span>
        </label>

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-500 leading-relaxed">
          <strong className="text-slate-600">Break rule (fixed by law, art. 134):</strong> at least 15 min once daily
          working time reaches 6h, +15 min over 9h, +15 min over 16h. Overtime is time worked beyond the daily norm
          above, not simply a long shift.
        </div>

        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-semibold shadow hover:from-indigo-400 hover:to-blue-400 active:scale-95 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save policy"}
          </button>
        </div>
      </Card>
    </div>
  );
}
