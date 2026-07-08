import { useEffect, useState, useCallback } from "react";
import { useSelector } from "react-redux";
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
  const user = useSelector((state) => state.auth.user);
  // Only admins may change limits; everyone else sees them read-only.
  const canEdit = ["ROLE_ADMIN", "ROLE_SUPER_ADMIN"].includes(user?.role);

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
      setError(getErrorMessage(err, "Could not load thresholds"));
    } finally {
      setLoading(false);
    }
  }, [year]);

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
      setNotice(`Saved the limit for ${category} (${year}).`);
    } catch (err) {
      setError(getErrorMessage(err, `Could not save the limit for ${category}`));
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
      setNotice(`Removed the limit for ${category} (${year}).`);
    } catch (err) {
      setError(getErrorMessage(err, `Could not remove the limit for ${category}`));
    } finally {
      setSavingKey("");
    }
  };

  return (
    <div>
      <PageHeader
        title="Legal Thresholds"
        subtitle="Set the BDO legal limits each annual report is checked against."
        actions={<YearSelector value={year} onChange={setYear} />}
      />

      {!canEdit && (
        <div className="mb-4">
          <AlertBanner level="info">
            You can view the configured limits, but only an administrator can change
            them.
          </AlertBanner>
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
        <div className="mb-4 text-sm text-slate-500">
          Values are in kilograms (kg). Leave a box empty to set no limit for that
          category. The legal maximum cannot be lower than the reporting threshold.
        </div>

        {loading ? (
          <Loader label="Loading thresholds…" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Reporting threshold (kg)</th>
                  <th className="py-2 pr-4">Legal maximum (kg)</th>
                  <th className="py-2 pr-4">Status</th>
                  {canEdit && <th className="py-2 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {WASTE_CATEGORIES.map((c) => {
                  const row = rows[c.key] || {};
                  const isSet = row.reportingThresholdKg !== "" || row.maxWeightKg !== "";
                  const busy = savingKey === c.key;
                  return (
                    <tr key={c.key} className="border-b border-slate-100">
                      <td className="py-3 pr-4">
                        <div className="font-medium text-slate-800">{c.label}</div>
                        <div className="text-xs text-slate-400">{c.labelPl}</div>
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
                          <Badge tone="green">Configured</Badge>
                        ) : (
                          <Badge tone="amber">Not set</Badge>
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
                            {busy ? "Saving…" : "Save"}
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={busy || !row._id}
                            onClick={() => onDelete(c.key)}
                          >
                            Clear
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
