import { useEffect, useState, useCallback } from "react";
import * as api from "../api/workpulseApi";
import { PageHeader, Card, Spinner, ErrorBanner, Badge } from "../components/ui";
import { useCapabilities } from "../hooks/useCapabilities";
import { useTranslation } from "../hooks/useTranslation";
import { useFormat } from "../hooks/useFormat";

// The settlement period (okres rozliczeniowy) — how many hours were really worked
// against the two limits Polish law sets:
//   - the average week must not go over 48h including overtime (Kodeks pracy art. 131)
//   - overtime must not go over 150h a year per person unless the workplace rules
//     say otherwise (art. 151 §3)
//
// ─────────────────────────────────────────────────────────────────────────────────
// THIS PAGE SHOWS TWO COMPLETELY DIFFERENT THINGS
// ─────────────────────────────────────────────────────────────────────────────────
// Which one you get depends on what you are allowed to read:
//
//   SETTLEMENT_READ_ALL  -> the whole workforce, one row per employee.
//                           Admins, HR and auditors have this.
//   SETTLEMENT_SELF_READ -> only your own balance. A normal worker has this, and
//                           nothing more, so they can never see a colleague's hours.
//
// Before this split the page always asked the server for the WHOLE-TENANT report,
// so a normal employee opening it got nothing but a "permission denied" error —
// even though their own balance is information they have every right to see. Each
// view now calls the endpoint that matches the permission the person actually holds.
export default function Settlement() {
  const { can, CAPABILITIES } = useCapabilities();

  // May this person see EVERYBODY's balance, or only their own?
  const canReadAll = can(CAPABILITIES.SETTLEMENT_READ_ALL);

  // The protected-status flags (pregnancy, young worker, parent of a small child)
  // are special-category data under GDPR art. 9, so they stay with HR and admins.
  // An AUDITOR deliberately does NOT get them: an auditor's job is to confirm the
  // LIMITS were respected, which the hours in this table already show. They do not
  // need to know who is pregnant (GDPR art. 5(1)(c), data minimisation).
  const canReadProtections = can(CAPABILITIES.PROFILE_READ);
  const canWriteProtections = can(CAPABILITIES.PROFILE_WRITE);

  return canReadAll ? (
    <TenantSettlement
      canReadProtections={canReadProtections}
      canWriteProtections={canWriteProtections}
    />
  ) : (
    <MySettlement />
  );
}

// ── View 1: the whole workforce (admins, HR, auditors) ────────────────────────
function TenantSettlement({ canReadProtections, canWriteProtections }) {
  const { t } = useTranslation();
  const { formatDate } = useFormat();

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
        title={t("settlement.title")}
        subtitle={t("settlement.subtitle")}
      >
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={onlyViolations}
            onChange={(e) => setOnlyViolations(e.target.checked)}
            className="w-4 h-4 accent-indigo-600"
          />
          {t("settlement.onlyBreaches")}
        </label>
      </PageHeader>

      <ErrorBanner message={error} />

      {period && (
        <p className="text-sm text-slate-500 mb-4">
          {t("settlement.currentPeriod")}:{" "}
          <span className="font-medium text-slate-700">{formatDate(period.start)}</span> →{" "}
          <span className="font-medium text-slate-700">{formatDate(period.end)}</span>
        </p>
      )}

      {loading ? (
        <Spinner label={t("settlement.calculating")} />
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-slate-500">
          {onlyViolations ? t("settlement.noBreaches") : t("settlement.noEntries")}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-4 py-3">{t("common.employee")}</th>
                  <th className="text-left font-medium px-4 py-3">{t("settlement.workedPeriod")}</th>
                  <th className="text-left font-medium px-4 py-3">{t("settlement.avgWeeklyCap")}</th>
                  <th className="text-left font-medium px-4 py-3">{t("settlement.overtimeYearCap")}</th>
                  {/* The "Protections" column holds health-related data, so it is
                      not even rendered for someone who may not read it. */}
                  {canReadProtections && (
                    <th className="text-right font-medium px-4 py-3">{t("settlement.protections")}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <SettlementRow
                    key={r.userId}
                    row={r}
                    showProtections={canReadProtections}
                    onEdit={() => setEditing(r)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Checked again here, not only on the button, so the health data can never
          be fetched by someone without PROFILE_READ. */}
      {editing && canReadProtections && (
        <ProtectionsModal
          row={editing}
          canWrite={canWriteProtections}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// ── View 2: just my own balance (a normal worker) ─────────────────────────────
//
// The same two legal limits, but only for the person looking at the screen. There
// is no table and no other name anywhere on it.
function MySettlement() {
  const { t } = useTranslation();
  const { formatDate, formatDuration } = useFormat();

  const [settlement, setSettlement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setSettlement(await api.getMySettlement());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Spinner label={t("settlement.myLoading")} />;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <PageHeader
        title={t("settlement.myTitle")}
        subtitle={t("settlement.mySubtitle")}
      />
      <ErrorBanner message={error} />

      {!settlement ? (
        <Card className="p-10 text-center text-slate-500">{t("settlement.noEntries")}</Card>
      ) : (
        <>
          {settlement.periodStart && (
            <p className="text-sm text-slate-500 mb-4">
              {t("settlement.currentPeriod")}:{" "}
              <span className="font-medium text-slate-700">{formatDate(settlement.periodStart)}</span> →{" "}
              <span className="font-medium text-slate-700">{formatDate(settlement.periodEnd)}</span>
            </p>
          )}

          <Card className="p-6">
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-semibold text-slate-700">{t("settlement.whereYouStand")}</p>
              <CapBadge s={settlement} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">{t("settlement.workedThisPeriod")}</p>
                <p className="text-2xl font-extrabold text-slate-800 mt-1">
                  {formatDuration(settlement.workedMinutes)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">{t("settlement.averageWeek")}</p>
                <p
                  className={`text-2xl font-extrabold mt-1 ${
                    settlement.exceedsWeeklyAverageCap ? "text-red-600" : "text-slate-800"
                  }`}
                >
                  {(settlement.averageWeeklyMinutes / 60).toFixed(1)}h
                  <span className="text-xs font-medium text-slate-400">
                    {" "}
                    {t("settlement.capSuffix", {
                      hours: (settlement.maxAverageWeeklyMinutes / 60).toFixed(0),
                    })}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">{t("settlement.overtimeThisYear")}</p>
                <p
                  className={`text-2xl font-extrabold mt-1 ${
                    settlement.exceedsAnnualOvertimeLimit
                      ? "text-red-600"
                      : settlement.approachingAnnualOvertimeLimit
                      ? "text-amber-600"
                      : "text-slate-800"
                  }`}
                >
                  {(settlement.annualOvertimeMinutes / 60).toFixed(1)}h
                  <span className="text-xs font-medium text-slate-400">
                    {" "}
                    {t("settlement.limitSuffix", {
                      hours: (settlement.annualOvertimeLimitMinutes / 60).toFixed(0),
                    })}
                  </span>
                </p>
              </div>
            </div>

            <p className="mt-5 pt-4 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
              {t("settlement.myNote")}
            </p>
          </Card>
        </>
      )}
    </div>
  );
}

// One short "are you inside the limits?" badge, used by the personal view.
function CapBadge({ s }) {
  const { t } = useTranslation();

  if (s.exceedsWeeklyAverageCap || s.exceedsAnnualOvertimeLimit) {
    return (
      <Badge cls="bg-red-50 text-red-700 border-red-200">{t("settlement.overALegalLimit")}</Badge>
    );
  }
  if (s.approachingAnnualOvertimeLimit) {
    return (
      <Badge cls="bg-amber-50 text-amber-700 border-amber-200">{t("settlement.nearYearlyLimit")}</Badge>
    );
  }
  return (
    <Badge cls="bg-emerald-50 text-emerald-700 border-emerald-200">{t("settlement.withinLimits")}</Badge>
  );
}

// One row of the reconciliation table, with cap badges.
function SettlementRow({ row, showProtections, onEdit }) {
  const { t } = useTranslation();
  const { formatDuration } = useFormat();

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
          <Badge cls="bg-red-50 text-red-700 border-red-200">
            {t("settlement.overCap", { hours: avgHours })}
          </Badge>
        ) : (
          <span className="text-slate-700">{avgHours}h</span>
        )}
      </td>
      <td className="px-4 py-3">
        {row.exceedsAnnualOvertimeLimit ? (
          <Badge cls="bg-red-50 text-red-700 border-red-200">
            {t("settlement.overLimit", { duration: annual })}
          </Badge>
        ) : row.approachingAnnualOvertimeLimit ? (
          <Badge cls="bg-amber-50 text-amber-700 border-amber-200">
            {t("settlement.nearLimit", { duration: annual })}
          </Badge>
        ) : (
          <span className="text-slate-700">{annual}</span>
        )}
      </td>
      {showProtections && (
        <td className="px-4 py-3 text-right">
          <button
            onClick={onEdit}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
          >
            {t("settlement.open")}
          </button>
        </td>
      )}
    </tr>
  );
}

// Modal to view/set an employee's special-group protection flags (art. 178/203).
//
// `canWrite` decides whether this is a form or a read-only card. Reading these
// flags and changing them are separate permissions (PROFILE_READ / PROFILE_WRITE)
// because they are health-related, special-category data under GDPR art. 9 — and
// because setting a flag changes what the law then allows for that person: a
// pregnant employee may not work overtime or nights at all (art. 178 §1), and the
// same is true for a young worker (art. 203).
function ProtectionsModal({ row, canWrite, onClose, onSaved }) {
  const { t } = useTranslation();

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
    // Guard as well as hiding the button, so the request can never be sent by
    // someone who may only read these flags.
    if (!canWrite) return;

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
        // A reader sees the real values but cannot change them.
        disabled={!canWrite}
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
            <h3 className="text-lg font-bold text-slate-900">{t("settlement.protectionsTitle")}</h3>
            <p className="text-sm text-slate-500">{row.employeeName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">
            ×
          </button>
        </div>

        <ErrorBanner message={error} />

        {loading ? (
          <Spinner label={t("settlement.protectionsLoading")} />
        ) : (
          <>
            {!canWrite && (
              <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 mb-3">
                {t("settlement.protectionsViewOnly")}
              </p>
            )}

            <div className="divide-y divide-slate-100">
              {check("isPregnant", t("settlement.pregnant"), t("settlement.pregnantHint"))}
              {check("isYoungWorker", t("settlement.youngWorker"), t("settlement.youngWorkerHint"))}
              {check(
                "isParentOfChildUnder4",
                t("settlement.parentUnder4"),
                t("settlement.parentUnder4Hint")
              )}
            </div>

            <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-xs text-slate-500 mb-1 font-medium">{t("settlement.consentTitle")}</p>
              {check("consentToOvertime", t("settlement.consentOvertime"))}
              {check("consentToNightWork", t("settlement.consentNightWork"))}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50"
              >
                {/* A reader has nothing to cancel — for them this just shuts the box. */}
                {canWrite ? t("common.cancel") : t("common.close")}
              </button>
              {canWrite && (
                <button
                  onClick={save}
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-sm font-semibold shadow hover:from-indigo-400 hover:to-blue-400 disabled:opacity-50"
                >
                  {saving ? t("common.saving") : t("common.save")}
                </button>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
