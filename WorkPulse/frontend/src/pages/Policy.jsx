import { useEffect, useState } from "react";
import * as api from "../api/workpulseApi";
import { PageHeader, Card, Spinner, ErrorBanner } from "../components/ui";
import { useCapabilities } from "../hooks/useCapabilities";
import { useTranslation } from "../hooks/useTranslation";

// The seven working-time systems the Polish Labour Code allows (art. 135-150).
// Only the CODES live here — the readable name of each one comes from the
// language file under "policy.systems", so the list is never translated twice.
const SYSTEMS = [
  "STANDARD",
  "EQUIVALENT",
  "TASK_BASED",
  "SHORTENED_WEEK",
  "WEEKEND_WORK",
  "FLEXIBLE",
  "INDIVIDUAL",
];

// The tenant's Working Time Policy (regulamin czasu pracy).
//
// EVERYONE may READ this page — a worker has to be able to see the daily norm,
// the break rule and the monitoring notice that apply to them. Only an ADMIN may
// CHANGE it, because the working-time system and the settlement period belong in
// the workplace rules or the collective agreement (Kodeks pracy art. 150), not in
// one manager's hands. That is why not even HR gets POLICY_WRITE.
//
// So the page has two modes: a normal form for an admin, and the same page
// locked for everybody else.
export default function Policy() {
  // One question decides the whole mode of this page: may this person change the
  // policy? The backend refuses PUT /api/policy without POLICY_WRITE anyway — this
  // check just means a reader never fills in a form that would be rejected.
  const { can, CAPABILITIES } = useCapabilities();
  const { t } = useTranslation();

  const canEdit = can(CAPABILITIES.POLICY_WRITE);

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
    // Second check, on top of hiding the button. If a future change ever calls
    // save() from somewhere else, a reader still cannot send the request.
    if (!canEdit) return;

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
      setMessage(t("policy.saved"));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner label={t("common.loading")} />;
  if (!policy) return <ErrorBanner message={error || t("policy.noPolicy")} />;

  const field = "mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-400 outline-none";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <PageHeader
        title={t("policy.title")}
        subtitle={canEdit ? t("policy.subtitleEdit") : t("policy.subtitleRead")}
      />
      <ErrorBanner message={error} />
      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3 mb-4">
          {message}
        </div>
      )}

      {/* Tell a reader plainly why the fields are greyed out, so a locked form does
          not look like a broken page. */}
      {!canEdit && (
        <div className="bg-slate-50 border border-slate-200 text-slate-600 text-sm rounded-xl px-4 py-3 mb-4">
          <span className="font-semibold text-slate-700">{t("policy.viewOnlyTitle")}</span>{" "}
          {t("policy.viewOnlyBody")}
        </div>
      )}

      <Card className="p-6">
        {/* One `disabled` fieldset locks EVERY field inside it — inputs, selects,
            checkboxes and the geofence buttons — instead of us remembering to add
            the same flag to twenty separate controls. Forgetting one of those is
            exactly how a read-only screen quietly becomes editable.
            `min-w-0` is needed because a fieldset otherwise refuses to shrink and
            would break the grid layout on small screens. */}
        <fieldset disabled={!canEdit} className="space-y-5 min-w-0">
        <label className="block text-sm">
          <span className="text-slate-500">{t("policy.system")}</span>
          <select value={policy.workingTimeSystem} onChange={(e) => set("workingTimeSystem", e.target.value)} className={field}>
            {SYSTEMS.map((code) => (
              <option key={code} value={code}>
                {t(`policy.systems.${code}`)}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="block text-sm">
            <span className="text-slate-500">{t("policy.dailyNorm")}</span>
            <input type="number" min="1" max="24" step="0.5" value={policy.standardDailyHours} onChange={(e) => set("standardDailyHours", e.target.value)} className={field} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">{t("policy.weeklyNorm")}</span>
            <input type="number" min="1" max="168" value={policy.standardWeeklyHours} onChange={(e) => set("standardWeeklyHours", e.target.value)} className={field} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">{t("policy.workDaysPerWeek")}</span>
            <input type="number" min="1" max="7" value={policy.workDaysPerWeek} onChange={(e) => set("workDaysPerWeek", e.target.value)} className={field} />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="block text-sm">
            <span className="text-slate-500">{t("policy.settlementPeriodMonths")}</span>
            <input type="number" min="1" max="12" value={policy.settlementPeriodMonths} onChange={(e) => set("settlementPeriodMonths", e.target.value)} className={field} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">{t("policy.dailyRest")}</span>
            <input type="number" min="1" max="24" value={policy.dailyRestHours} onChange={(e) => set("dailyRestHours", e.target.value)} className={field} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">{t("policy.weeklyRest")}</span>
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
          <span className="text-slate-700">{t("policy.overtimeNeedsApproval")}</span>
        </label>

        {/* ── Settlement-period caps (art. 131 / 151 §3) ─────────────────── */}
        <div className="pt-2 border-t border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">{t("policy.limitsTitle")}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="text-slate-500">{t("policy.maxAvgWeekly")}</span>
              <input type="number" min="1" max="60" value={policy.maxAverageWeeklyHours ?? 48} onChange={(e) => set("maxAverageWeeklyHours", e.target.value)} className={field} />
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">{t("policy.annualOvertimeLimit")}</span>
              <input type="number" min="0" max="600" value={policy.annualOvertimeLimitHours ?? 150} onChange={(e) => set("annualOvertimeLimitHours", e.target.value)} className={field} />
            </label>
          </div>
        </div>

        {/* ── Night work (art. 151⁷/151⁸) ────────────────────────────────── */}
        <div className="pt-2 border-t border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">{t("policy.nightTitle")}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block text-sm">
              <span className="text-slate-500">{t("policy.nightStart")}</span>
              <input type="number" min="0" max="23" value={policy.nightStartHour ?? 21} onChange={(e) => set("nightStartHour", e.target.value)} className={field} />
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">{t("policy.nightEnd")}</span>
              <input type="number" min="0" max="23" value={policy.nightEndHour ?? 7} onChange={(e) => set("nightEndHour", e.target.value)} className={field} />
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">{t("policy.nightPremium")}</span>
              <input type="number" min="0" max="100" value={policy.nightPremiumPercent ?? 20} onChange={(e) => set("nightPremiumPercent", e.target.value)} className={field} />
            </label>
          </div>
        </div>

        {/* ── Location monitoring (art. 22²) ─────────────────────────────── */}
        <div className="pt-2 border-t border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">{t("policy.locationTitle")}</h3>
          <p className="text-xs text-slate-400 mb-3">
            {t("policy.locationIntro")}
          </p>

          <label className="flex items-center gap-3 text-sm mb-3">
            <input type="checkbox" checked={!!policy.locationTrackingEnabled} onChange={(e) => set("locationTrackingEnabled", e.target.checked)} className="w-4 h-4 accent-indigo-600" />
            <span className="text-slate-700">{t("policy.recordLocation")}</span>
          </label>

          {policy.locationTrackingEnabled && (
            <div className="space-y-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" checked={!!policy.blockOutsideGeofence} onChange={(e) => set("blockOutsideGeofence", e.target.checked)} className="w-4 h-4 accent-indigo-600" />
                  <span className="text-slate-700">{t("policy.blockOutside")}</span>
                </label>
                <label className="block text-sm">
                  <span className="text-slate-500">{t("policy.ignoreGpsWorse")}</span>
                  <input type="number" min="10" max="1000" value={policy.maxAccuracyMeters ?? 100} onChange={(e) => set("maxAccuracyMeters", e.target.value)} className={field} />
                </label>
              </div>

              <GeofenceEditor
                geofences={policy.geofences || []}
                onChange={(list) => set("geofences", list)}
                field={field}
              />

              <label className="block text-sm">
                <span className="text-slate-500">{t("policy.monitoringNoticeText")}</span>
                <textarea rows={4} value={policy.monitoringNoticeText || ""} onChange={(e) => set("monitoringNoticeText", e.target.value)} className={field} />
              </label>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-500 leading-relaxed">
          <strong className="text-slate-600">{t("policy.breakRuleTitle")}</strong>{" "}
          {t("policy.breakRuleBody")}
        </div>
        </fieldset>

        {/* No Save button at all for a reader — there is nothing for them to save. */}
        {canEdit && (
          <div className="flex justify-end mt-5">
            <button
              onClick={save}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-semibold shadow hover:from-indigo-400 hover:to-blue-400 active:scale-95 disabled:opacity-50"
            >
              {saving ? t("common.saving") : t("policy.savePolicy")}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}

// A small editor for the list of allowed work-site circles (geofences).
// Each row is a site name plus its centre coordinates and radius in metres.
function GeofenceEditor({ geofences, onChange, field }) {
  const { t } = useTranslation();

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
        <span className="text-sm text-slate-600 font-medium">{t("policy.allowedSites")}</span>
        <button
          type="button"
          onClick={add}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
        >
          {t("policy.addSite")}
        </button>
      </div>

      {geofences.length === 0 && (
        <p className="text-xs text-slate-400">
          {t("policy.noSites")}
        </p>
      )}

      <div className="space-y-2">
        {geofences.map((g, i) => (
          <div key={i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
            <input placeholder={t("policy.site")} value={g.site || ""} onChange={(e) => update(i, "site", e.target.value)} className={field} />
            <input placeholder={t("policy.latitude")} value={g.latitude ?? ""} onChange={(e) => update(i, "latitude", e.target.value)} className={field} />
            <input placeholder={t("policy.longitude")} value={g.longitude ?? ""} onChange={(e) => update(i, "longitude", e.target.value)} className={field} />
            <input placeholder={t("policy.radius")} value={g.radiusMeters ?? 200} onChange={(e) => update(i, "radiusMeters", e.target.value)} className={field} />
            <button
              type="button"
              onClick={() => remove(i)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-slate-500 text-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200"
            >
              {t("policy.remove")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
