import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useDispatch, useSelector } from "react-redux";
import { fetchCompanies, setActiveCompany } from "../store/slices/companySlice";
import {
  fetchMonthlyEntries,
  recordMonthlyEntry,
  fetchEntryHistory,
  clearHistory,
  clearSubmitError,
} from "../store/slices/wasteEntrySlice";
import {
  PageHeader,
  Card,
  Button,
  Loader,
  AlertBanner,
  Badge,
  EmptyState,
} from "../components/common";
import { CompanySelector, YearSelector } from "../components/common/Selectors";
import { WASTE_CATEGORIES, MONTH_NAMES } from "../utils/constants";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

// Turns an entry's items array into a quick { CATEGORY: weight } lookup.
const itemsToMap = (items = []) =>
  items.reduce((acc, it) => {
    acc[it.category] = it.weightKg;
    return acc;
  }, {});

export default function WasteEntries() {
  const dispatch = useDispatch();
  const { list: companies, activeCompanyId } = useSelector((state) => state.companies);
  const { entries, loading, submitting, submitError, history, historyLoading } = useSelector(
    (state) => state.wasteEntries
  );

  const [year, setYear] = useState(new Date().getFullYear());
  const [historyMonth, setHistoryMonth] = useState(null);

  const { register, handleSubmit, reset, watch } = useForm({
    defaultValues: { month: 1, notes: "" },
  });
  const selectedMonth = Number(watch("month"));

  // Load the companies once.
  useEffect(() => {
    dispatch(fetchCompanies());
  }, [dispatch]);

  // Whenever the chosen company or year changes, (re)load that year's entries.
  useEffect(() => {
    if (activeCompanyId) {
      dispatch(fetchMonthlyEntries({ companyId: activeCompanyId, year }));
    }
  }, [dispatch, activeCompanyId, year]);

  // Map of month number -> entry, for the table and for pre-filling the form.
  const entryByMonth = useMemo(() => {
    const map = {};
    for (const e of entries) map[e.month] = e;
    return map;
  }, [entries]);

  // When the user picks a month in the form, pre-fill the weights with the
  // current values for that month (so a correction starts from what's there).
  useEffect(() => {
    const existing = entryByMonth[selectedMonth];
    const values = itemsToMap(existing?.items);
    const patch = {};
    for (const cat of WASTE_CATEGORIES) {
      patch[`w_${cat.key}`] = values[cat.key] ?? "";
    }
    reset((prev) => ({ ...prev, ...patch, notes: "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, entries]);

  // Submit a month. We build the items array from the per-category inputs,
  // dropping blanks. The backend saves this as a new version.
  const onSubmit = async (data) => {
    dispatch(clearSubmitError());
    // Build one waste line per category from the form inputs.
    // We keep the raw text from each box first so we can tell a box the user
    // left BLANK apart from a "0" the user actually typed on purpose.
    const items = WASTE_CATEGORIES.map((cat) => ({
      category: cat.key,
      raw: data[`w_${cat.key}`],
    }))
      // Skip only the boxes the user left empty. A typed 0 is kept.
      .filter((it) => it.raw !== "" && it.raw !== undefined && it.raw !== null)
      // Turn the kept boxes into the { category, weightKg } shape the API wants.
      .map((it) => ({ category: it.category, weightKg: Number(it.raw) }))
      // Safety net: drop anything that still isn't a real number.
      .filter((it) => !Number.isNaN(it.weightKg));

    if (items.length === 0) return;

    await dispatch(
      recordMonthlyEntry({
        companyId: activeCompanyId,
        year,
        month: Number(data.month),
        items,
        notes: data.notes,
      })
    );
  };

  // Open the version-history panel for a given month.
  const openHistory = (month) => {
    setHistoryMonth(month);
    dispatch(fetchEntryHistory({ companyId: activeCompanyId, year, month }));
  };
  const closeHistory = () => {
    setHistoryMonth(null);
    dispatch(clearHistory());
  };

  if (companies.length === 0) {
    return (
      <div>
        <PageHeader title="Waste Entries" />
        <EmptyState
          title="No companies yet"
          message="Add a company first, then you can record its monthly waste data."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Waste Entries"
        subtitle="Record monthly packaging waste. Saved data is never overwritten — corrections create a new version."
        actions={
          <div className="flex items-center gap-3">
            <CompanySelector
              companies={companies}
              value={activeCompanyId}
              onChange={(id) => dispatch(setActiveCompany(id))}
            />
            <YearSelector value={year} onChange={setYear} />
          </div>
        }
      />

      {submitError && (
        <div className="mb-4">
          <AlertBanner level="error">{submitError}</AlertBanner>
        </div>
      )}

      {/* ── Record / correct a month ────────────────────────────────────────── */}
      <Card className="p-6 mb-6">
        <div className="text-sm font-semibold text-slate-700 mb-4">
          Record / correct a month
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Month</label>
              <select className={inputClass + " w-40"} {...register("month")}>
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            {entryByMonth[selectedMonth] && (
              <Badge tone="blue">
                Current version: v{entryByMonth[selectedMonth].version}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {WASTE_CATEGORIES.map((cat) => (
              <div key={cat.key}>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  {cat.label} (kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  className={inputClass}
                  {...register(`w_${cat.key}`)}
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Notes (optional)
            </label>
            <input
              className={inputClass}
              placeholder="e.g. corrected after invoice review"
              {...register("notes")}
            />
          </div>

          <Button type="submit" disabled={submitting || !activeCompanyId}>
            {submitting ? "Saving…" : "Save month"}
          </Button>
        </form>
      </Card>

      {/* ── The 12-month grid ───────────────────────────────────────────────── */}
      {loading ? (
        <Loader label="Loading entries…" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-3 font-medium">Month</th>
                  {WASTE_CATEGORIES.map((c) => (
                    <th key={c.key} className="px-4 py-3 font-medium text-right">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-medium text-right">Total (kg)</th>
                  <th className="px-4 py-3 font-medium text-right">Version</th>
                  <th className="px-4 py-3 font-medium text-right">History</th>
                </tr>
              </thead>
              <tbody>
                {MONTH_NAMES.map((name, idx) => {
                  const month = idx + 1;
                  const entry = entryByMonth[month];
                  const map = itemsToMap(entry?.items);
                  return (
                    <tr
                      key={month}
                      className={`border-b border-slate-100 ${
                        entry ? "" : "text-slate-400"
                      }`}
                    >
                      <td className="px-4 py-2.5 font-medium text-slate-700">{name}</td>
                      {WASTE_CATEGORIES.map((c) => (
                        <td key={c.key} className="px-4 py-2.5 text-right">
                          {entry ? (map[c.key] ?? 0) : "—"}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                        {entry ? entry.totalWeightKg : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {entry ? <Badge tone="blue">v{entry.version}</Badge> : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {entry ? (
                          <button
                            onClick={() => openHistory(month)}
                            className="text-emerald-700 hover:underline text-xs font-medium"
                          >
                            View
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Version history panel ───────────────────────────────────────────── */}
      {historyMonth && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="font-semibold text-slate-900">
                {MONTH_NAMES[historyMonth - 1]} {year} — version history
              </div>
              <button onClick={closeHistory} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>
            <div className="p-6">
              {historyLoading ? (
                <Loader label="Loading history…" />
              ) : history.length === 0 ? (
                <p className="text-sm text-slate-500">No history found.</p>
              ) : (
                <div className="space-y-4">
                  {history.map((v) => (
                    <div key={v._id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge tone={v.isLatest ? "green" : "slate"}>
                          v{v.version} {v.isLatest ? "(current)" : ""}
                        </Badge>
                        <span className="text-xs text-slate-400">
                          {new Date(v.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600">
                        {v.items.map((it) => `${it.category}: ${it.weightKg}kg`).join(" · ")}
                      </div>
                      <div className="mt-1 text-sm font-medium">Total: {v.totalWeightKg} kg</div>
                      {v.notes && (
                        <div className="mt-1 text-xs text-slate-500">Note: {v.notes}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
