import { useEffect, useState, useCallback } from "react";
import {
  PageHeader,
  Card,
  Button,
  Loader,
  AlertBanner,
  Badge,
} from "../components/common";
import { YearSelector } from "../components/common/Selectors";
import { WASTE_CATEGORIES, recentYears } from "../utils/constants";
import { fetchThresholds, saveThreshold, deleteThreshold } from "../api/thresholdApi";
import { getErrorMessage } from "../api/axiosClient";
import { useCapabilities } from "../hooks/useCapabilities";
import { useTranslation } from "../hooks/useTranslation";

// The Thresholds page lets an administrator set the legal limits that annual
// reports are checked against. Before this page existed there was NO way to fill
// the thresholds table, so the report's "legal threshold check" always passed
// even when nothing had been checked. Setting real limits here is what makes
// that check meaningful.
//
// For each waste category (in the chosen year) an admin can set:
//   - Reporting threshold (kg): a "must report" line — informational.
//   - Legal maximum (kg):       going over this is a hard breach.

export default function Thresholds() {
  // Only a WasteSync admin may change limits; everyone else sees them read-only.
  //
  // WHAT CHANGED AND WHY: this used to read the PLATFORM role from Redux
  // (["ROLE_ADMIN", "ROLE_SUPER_ADMIN"].includes(user?.role)). That is the wrong
  // question, because every tenant admin on RegulaOne holds ROLE_ADMIN — including
  // admins of other apps who were never given WasteSync at all. They would have been
  // shown editable limit boxes, and the save would then have been refused by the
  // server. Asking for the THRESHOLD_WRITE capability asks the narrower, correct
  // question and matches exactly what the backend now enforces.
  const { can, CAPABILITIES } = useCapabilities();
  const canEdit = can(CAPABILITIES.THRESHOLD_WRITE);

  // Words and category names for the chosen language (Polish by default).
  const { t, categoryLabel } = useTranslation();

  const [year, setYear] = useState(recentYears()[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // rows is keyed by category: { PAPER: { _id, reportingThresholdKg, maxWeightKg }, ... }
  const [rows, setRows] = useState({});
  const [savingKey, setSavingKey] = useState("");

  // Load the saved thresholds for the year and merge them onto the full list of
  // categories, so every category always shows a row (even if it has no limit).
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { thresholds } = await fetchThresholds(year);
      const byCategory = {};
      for (const c of WASTE_CATEGORIES) {
        byCategory[c.key] = { reportingThresholdKg: "", maxWeightKg: "" };
      }
      for (const t of thresholds || []) {
        byCategory[t.category] = {
          _id: t._id,
          reportingThresholdKg: t.reportingThresholdKg ?? "",
          maxWeightKg: t.maxWeightKg ?? "",
        };
      }
      setRows(byCategory);
    } catch (err) {
      // getErrorMessage prefers the server's own explanation and only falls back to
      // the wording we pass in, so it is that fallback which needs translating.
      setError(getErrorMessage(err, t("thresholds.loadError")));
    } finally {
      setLoading(false);
    }
    // `t` is in the dependency list because it changes when the language changes.
    // Without it, an error raised in Polish would keep its Polish wording after the
    // user switched to English until they reloaded the page.
  }, [year, t]);

  useEffect(() => {
    load();
  }, [load]);

  // Update one field of one category row in local state as the admin types.
  const onFieldChange = (category, field, value) => {
    setRows((prev) => ({
      ...prev,
      [category]: { ...prev[category], [field]: value },
    }));
  };

  // Save (create or update) the limit for one category.
  const onSave = async (category) => {
    setError("");
    setNotice("");
    setSavingKey(category);
    try {
      const row = rows[category];
      const saved = await saveThreshold({
        category,
        year,
        // Send null (not "") so the backend clears a limit the admin emptied.
        reportingThresholdKg:
          row.reportingThresholdKg === "" ? null : Number(row.reportingThresholdKg),
        maxWeightKg: row.maxWeightKg === "" ? null : Number(row.maxWeightKg),
      });
      // Keep the returned id so a later delete works without a reload.
      setRows((prev) => ({
        ...prev,
        [category]: {
          _id: saved._id,
          reportingThresholdKg: saved.reportingThresholdKg ?? "",
          maxWeightKg: saved.maxWeightKg ?? "",
        },
      }));
      // The message names the category the way the user sees it on screen
      // ("Papier i tektura"), not the internal code ("PAPER").
      setNotice(
        t("thresholds.savedNotice", { category: categoryLabel(category), year })
      );
    } catch (err) {
      setError(
        getErrorMessage(err, t("thresholds.saveError", { category: categoryLabel(category) }))
      );
    } finally {
      setSavingKey("");
    }
  };

  // Remove the saved limit for one category.
  const onDelete = async (category) => {
    const row = rows[category];
    if (!row?._id) return; // nothing saved to delete
    setError("");
    setNotice("");
    setSavingKey(category);
    try {
      await deleteThreshold(row._id);
      setRows((prev) => ({
        ...prev,
        [category]: { reportingThresholdKg: "", maxWeightKg: "" },
      }));
      setNotice(
        t("thresholds.removedNotice", { category: categoryLabel(category), year })
      );
    } catch (err) {
      setError(
        getErrorMessage(err, t("thresholds.removeError", { category: categoryLabel(category) }))
      );
    } finally {
      setSavingKey("");
    }
  };

  return (
    <div>
      <PageHeader
        title={t("thresholds.title")}
        subtitle={t("thresholds.subtitle")}
        actions={<YearSelector value={year} onChange={setYear} />}
      />

      {!canEdit && (
        <div className="mb-4">
          <AlertBanner level="info">{t("thresholds.readOnlyNotice")}</AlertBanner>
        </div>
      )}

      {error && (
        <div className="mb-4">
          <AlertBanner level="error">{error}</AlertBanner>
        </div>
      )}
      {notice && (
        <div className="mb-4">
          <AlertBanner level="success">{notice}</AlertBanner>
        </div>
      )}

      <Card className="p-6">
        <div className="mb-4 text-sm text-slate-500">{t("thresholds.hint")}</div>

        {loading ? (
          <Loader label={t("thresholds.loading")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4">{t("common.category")}</th>
                  <th className="py-2 pr-4">{t("thresholds.reportingThreshold")}</th>
                  <th className="py-2 pr-4">{t("thresholds.legalMaximum")}</th>
                  <th className="py-2 pr-4">{t("common.status")}</th>
                  {canEdit && <th className="py-2 text-right">{t("common.actions")}</th>}
                </tr>
              </thead>
              <tbody>
                {WASTE_CATEGORIES.map((c) => {
                  const row = rows[c.key] || {};
                  const isSet = row.reportingThresholdKg !== "" || row.maxWeightKg !== "";
                  const busy = savingKey === c.key;
                  return (
                    <tr key={c.key} className="border-b border-slate-100">
                      {/* WHAT CHANGED AND WHY: this cell used to print the English
                          name with the Polish name in small grey text underneath.
                          That was a workaround for having no language switch — it was
                          the only way a Polish user could see a Polish word here, and
                          it cost every user a line of text they could not read. With
                          a real switch in the header, one name in the user's own
                          language is both correct and shorter. */}
                      <td className="py-3 pr-4">
                        <div className="font-medium text-slate-800">{categoryLabel(c.key)}</div>
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          disabled={!canEdit || busy}
                          value={row.reportingThresholdKg}
                          onChange={(e) =>
                            onFieldChange(c.key, "reportingThresholdKg", e.target.value)
                          }
                          className="w-32 rounded-md border border-slate-300 px-2 py-1.5 disabled:bg-slate-50"
                          placeholder="—"
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          disabled={!canEdit || busy}
                          value={row.maxWeightKg}
                          onChange={(e) =>
                            onFieldChange(c.key, "maxWeightKg", e.target.value)
                          }
                          className="w-32 rounded-md border border-slate-300 px-2 py-1.5 disabled:bg-slate-50"
                          placeholder="—"
                        />
                      </td>
                      <td className="py-3 pr-4">
                        {isSet ? (
                          <Badge tone="green">{t("thresholds.configured")}</Badge>
                        ) : (
                          <Badge tone="amber">{t("common.notSet")}</Badge>
                        )}
                      </td>
                      {canEdit && (
                        <td className="py-3 text-right whitespace-nowrap">
                          <Button
                            variant="primary"
                            className="mr-2"
                            disabled={busy}
                            onClick={() => onSave(c.key)}
                          >
                            {busy ? t("common.saving") : t("common.save")}
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={busy || !row._id}
                            onClick={() => onDelete(c.key)}
                          >
                            {t("common.clear")}
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
