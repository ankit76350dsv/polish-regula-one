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
        // Settlement-period caps (art. 131 / 151 §3).
        maxAverageWeeklyHours: Number(policy.maxAverageWeeklyHours),
        annualOvertimeLimitHours: Number(policy.annualOvertimeLimitHours),
        // Night work (art. 151⁷/151⁸).
        nightStartHour: Number(policy.nightStartHour),
        nightEndHour: Number(policy.nightEndHour),
        nightPremiumPercent: Number(policy.nightPremiumPercent),
        // Location monitoring (art. 22²).
        locationTrackingEnabled: !!policy.locationTrackingEnabled,
        blockOutsideGeofence: !!policy.blockOutsideGeofence,
        maxAccuracyMeters: Number(policy.maxAccuracyMeters),
        monitoringNoticeText: policy.monitoringNoticeText,
        // Keep only complete geofence rows (need both coordinates).
        geofences: (policy.geofences || [])
          .filter((g) => g.latitude !== "" && g.longitude !== "")
          .map((g) => ({
            site: g.site,
            latitude: Number(g.latitude),
            longitude: Number(g.longitude),
            radiusMeters: Number(g.radiusMeters) || 200,
          })),
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

        {/* ── Settlement-period caps (art. 131 / 151 §3) ─────────────────── */}
        <div className="pt-2 border-t border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Settlement-period limits</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="text-slate-500">Max average weekly hours (art. 131)</span>
              <input type="number" min="1" max="60" value={policy.maxAverageWeeklyHours ?? 48} onChange={(e) => set("maxAverageWeeklyHours", e.target.value)} className={field} />
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">Yearly overtime limit — hours (art. 151 §3)</span>
              <input type="number" min="0" max="600" value={policy.annualOvertimeLimitHours ?? 150} onChange={(e) => set("annualOvertimeLimitHours", e.target.value)} className={field} />
            </label>
          </div>
        </div>

        {/* ── Night work (art. 151⁷/151⁸) ────────────────────────────────── */}
        <div className="pt-2 border-t border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Night work</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block text-sm">
              <span className="text-slate-500">Night starts (hour)</span>
              <input type="number" min="0" max="23" value={policy.nightStartHour ?? 21} onChange={(e) => set("nightStartHour", e.target.value)} className={field} />
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">Night ends (hour)</span>
              <input type="number" min="0" max="23" value={policy.nightEndHour ?? 7} onChange={(e) => set("nightEndHour", e.target.value)} className={field} />
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">Night bonus (%)</span>
              <input type="number" min="0" max="100" value={policy.nightPremiumPercent ?? 20} onChange={(e) => set("nightPremiumPercent", e.target.value)} className={field} />
            </label>
          </div>
        </div>

        {/* ── Location monitoring (art. 22²) ─────────────────────────────── */}
        <div className="pt-2 border-t border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Location monitoring</h3>
          <p className="text-xs text-slate-400 mb-3">
            Off by default. Turning this on tracks where mobile clock-ins happen — this is employee
            monitoring under art. 22², so employees must accept the notice first.
          </p>

          <label className="flex items-center gap-3 text-sm mb-3">
            <input type="checkbox" checked={!!policy.locationTrackingEnabled} onChange={(e) => set("locationTrackingEnabled", e.target.checked)} className="w-4 h-4 accent-indigo-600" />
            <span className="text-slate-700">Record clock-in / clock-out location</span>
          </label>

          {policy.locationTrackingEnabled && (
            <div className="space-y-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" checked={!!policy.blockOutsideGeofence} onChange={(e) => set("blockOutsideGeofence", e.target.checked)} className="w-4 h-4 accent-indigo-600" />
                  <span className="text-slate-700">Block clock-in outside a work site</span>
                </label>
                <label className="block text-sm">
                  <span className="text-slate-500">Ignore GPS worse than (metres)</span>
                  <input type="number" min="10" max="1000" value={policy.maxAccuracyMeters ?? 100} onChange={(e) => set("maxAccuracyMeters", e.target.value)} className={field} />
                </label>
              </div>

              <GeofenceEditor
                geofences={policy.geofences || []}
                onChange={(list) => set("geofences", list)}
                field={field}
              />

              <label className="block text-sm">
                <span className="text-slate-500">Monitoring notice shown to employees</span>
                <textarea rows={4} value={policy.monitoringNoticeText || ""} onChange={(e) => set("monitoringNoticeText", e.target.value)} className={field} />
              </label>
            </div>
          )}
        </div>

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

// A small editor for the list of allowed work-site circles (geofences).
// Each row is a site name plus its centre coordinates and radius in metres.
function GeofenceEditor({ geofences, onChange, field }) {
  const update = (i, key, value) => {
    const next = geofences.map((g, idx) => (idx === i ? { ...g, [key]: value } : g));
    onChange(next);
  };
  const add = () =>
    onChange([...geofences, { site: "", latitude: "", longitude: "", radiusMeters: 200 }]);
  const remove = (i) => onChange(geofences.filter((_, idx) => idx !== i));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-600 font-medium">Allowed work sites</span>
        <button
          type="button"
          onClick={add}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
        >
          + Add site
        </button>
      </div>

      {geofences.length === 0 && (
        <p className="text-xs text-slate-400">
          No sites set. Without a site, "on-site" cannot be checked — clock-ins are only recorded.
        </p>
      )}

      <div className="space-y-2">
        {geofences.map((g, i) => (
          <div key={i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
            <input placeholder="Site" value={g.site || ""} onChange={(e) => update(i, "site", e.target.value)} className={field} />
            <input placeholder="Latitude" value={g.latitude ?? ""} onChange={(e) => update(i, "latitude", e.target.value)} className={field} />
            <input placeholder="Longitude" value={g.longitude ?? ""} onChange={(e) => update(i, "longitude", e.target.value)} className={field} />
            <input placeholder="Radius (m)" value={g.radiusMeters ?? 200} onChange={(e) => update(i, "radiusMeters", e.target.value)} className={field} />
            <button
              type="button"
              onClick={() => remove(i)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-slate-500 text-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
