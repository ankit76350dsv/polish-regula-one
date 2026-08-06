import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchMonthlyEntries,
  recordMonthlyEntry,
  fetchEntryHistory,
  clearHistory,
  clearSubmitError,
} from "../store/slices/wasteEntrySlice";
import { Card, Button, Loader, AlertBanner, Badge } from "../components/common";
import {
  WASTE_CATEGORIES,
  MONTHS_IN_YEAR,
  CATEGORY_COLORS,
  recentYears,
  defaultReportingYear,
} from "../utils/constants";
import { useCapabilities } from "../hooks/useCapabilities";
import { useTranslation } from "../hooks/useTranslation";

// ── Small helpers ────────────────────────────────────────────────────────────

// Turns an entry's items array into a quick { CATEGORY: weight } lookup.
const itemsToMap = (items = []) =>
  items.reduce((acc, it) => {
    acc[it.category] = it.weightKg;
    return acc;
  }, {});

// ── Inline icons ─────────────────────────────────────────────────────────────
// The icons are drawn here as plain SVG shapes. We do it this way so the page
// does not need an extra icon library to download. Each icon takes its colour
// from the text around it (that is what "currentColor" means).
const icons = {
  recycle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12M14 16l-3 3 3 3M8.293 13.596 7.196 9.5 3.1 10.598M9.344 5.811l1.093-1.892a1.83 1.83 0 0 1 3.149-.001l1.226 2.12M13.378 9.633l4.096-1.098 1.098 4.096" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  pencil: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  grid: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M3 15h18M9 9v12" strokeLinecap="round" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  calendarCheck: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  scale: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M12 3v18M7 21h10M5 7l-3 7h6zM19 7l-3 7h6zM4 7h16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  layers: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M12 3 3 8l9 5 9-5zM3 13l9 5 9-5M3 18l9 5 9-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  save: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z M17 21v-8H7v8M7 3v5h8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  note: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  ),
  spinner: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 animate-spin">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
};

// A tiny picture for each kind of waste, so a person can find the right box by
// its shape and colour instead of having to read all five labels every time.
const CATEGORY_ICONS = {
  PAPER: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  PLASTIC: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
      <path d="M10 2h4v3a4 4 0 0 0 2 3.5A4 4 0 0 1 18 12v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-8a4 4 0 0 1 2-3.5A4 4 0 0 0 10 5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  GLASS: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
      <path d="M6 3h12l-1 7a5 5 0 0 1-10 0zM12 15v6M8 21h8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  METAL: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
      <ellipse cx="12" cy="5" rx="6" ry="2.5" />
      <path d="M6 5v14c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V5" strokeLinecap="round" />
    </svg>
  ),
  MIXED: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
      <path d="M12 3 3 8l9 5 9-5zM3 13l9 5 9-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

// ── Metric tile ───────────────────────────────────────────────────────────────
// One big number with a label and an icon. Same shape as the tiles on the
// dashboard, so the two pages feel like one product.
const accents = {
  emerald: { chip: "bg-emerald-50 text-emerald-600", value: "text-slate-900", glow: "bg-emerald-300" },
  blue: { chip: "bg-blue-50 text-blue-600", value: "text-slate-900", glow: "bg-blue-300" },
  violet: { chip: "bg-violet-50 text-violet-600", value: "text-slate-900", glow: "bg-violet-300" },
  amber: { chip: "bg-amber-50 text-amber-600", value: "text-amber-600", glow: "bg-amber-300" },
};

function MetricCard({ icon, label, value, hint, accent = "emerald" }) {
  const a = accents[accent] || accents.emerald;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      {/* Soft coloured glow in the corner — pure decoration. */}
      <div className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-50 blur-2xl ${a.glow}`} />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
          <div className={`mt-2 text-3xl font-bold ${a.value}`}>{value}</div>
          {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${a.chip}`}>{icon}</div>
      </div>
    </div>
  );
}

// ── Section header — a small icon chip + a title, used above each panel ────────
function SectionTitle({ icon, children, hint, right }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          {icon}
        </span>
        <span className="text-sm font-semibold text-slate-700">{children}</span>
        {hint && <span className="text-xs text-slate-400">· {hint}</span>}
      </div>
      {right}
    </div>
  );
}

// The text boxes all share this look, so every field on the page lines up.
const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition placeholder:text-slate-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30";

export default function WasteEntries() {
  const dispatch = useDispatch();
  const { entries, loading, submitting, submitError, history, historyLoading } = useSelector(
    (state) => state.wasteEntries
  );

  // Between 1 January and 15 March this opens on LAST year, because that is the
  // year being closed out for the filing due on 15 March. The rest of the year it
  // opens on the current one, which is the year being recorded month by month.
  const [year, setYear] = useState(defaultReportingYear);
  const [historyMonth, setHistoryMonth] = useState(null);

  // May this person record or correct a month? An auditor may only read, so the
  // whole "record / correct a month" form is hidden for them — the 12-month grid
  // and the version history stay visible, which is what an audit needs.
  const { can, CAPABILITIES } = useCapabilities();
  const canWrite = can(CAPABILITIES.WASTE_ENTRY_WRITE);

  // Words, month names, category names, numbers and dates for the chosen language.
  // `formatNumber` replaces the page's old fmt() helper: it writes weights the way
  // the language writes numbers, so a Polish reader sees "1 234,5" and an English
  // one "1,234.5" — the same figure, written the way each expects it.
  const { t, monthNames, categoryLabel, formatNumber, formatDateTime } = useTranslation();

  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: { month: 1, notes: "" },
  });
  const selectedMonth = Number(watch("month"));

  // Whenever the chosen year changes, (re)load that year's entries. There is no
  // company to pick — the backend scopes everything to the signed-in tenant.
  useEffect(() => {
    dispatch(fetchMonthlyEntries({ year }));
  }, [dispatch, year]);

  // Map of month number -> entry, for the table and for pre-filling the form.
  const entryByMonth = useMemo(() => {
    const map = {};
    for (const e of entries) map[e.month] = e;
    return map;
  }, [entries]);

  // A few numbers about the whole year, worked out from the entries we already
  // have. These only feed the summary tiles and the totals row — nothing here is
  // sent to the server, so the figures the backend reports stay the authority.
  const summary = useMemo(() => {
    const recordedMonths = Object.keys(entryByMonth).map(Number).sort((a, b) => a - b);
    // Month NUMBERS (1-12), not names — which months have no figures yet. Working
    // from the count rather than a list of names keeps this maths independent of
    // whatever language the screen happens to be in.
    const missingMonths = Array.from({ length: MONTHS_IN_YEAR }, (_, i) => i + 1).filter(
      (m) => !entryByMonth[m]
    );

    // Add up every month, both as one grand total and split by category.
    const categoryTotals = {};
    for (const cat of WASTE_CATEGORIES) categoryTotals[cat.key] = 0;
    let grandTotal = 0;
    let biggestMonthKg = 0;

    for (const entry of Object.values(entryByMonth)) {
      grandTotal += Number(entry.totalWeightKg || 0);
      biggestMonthKg = Math.max(biggestMonthKg, Number(entry.totalWeightKg || 0));
      for (const it of entry.items || []) {
        if (categoryTotals[it.category] === undefined) categoryTotals[it.category] = 0;
        categoryTotals[it.category] += Number(it.weightKg || 0);
      }
    }

    // Which kind of waste weighs the most this year? Useful at a glance, and it
    // is the first thing an inspector asks about.
    let topCategory = null;
    for (const cat of WASTE_CATEGORIES) {
      if (!topCategory || categoryTotals[cat.key] > categoryTotals[topCategory.key]) {
        topCategory = cat;
      }
    }

    return {
      recordedCount: recordedMonths.length,
      missingMonths,
      categoryTotals,
      grandTotal,
      biggestMonthKg,
      topCategory: grandTotal > 0 ? topCategory : null,
    };
  }, [entryByMonth]);

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
        year,
        month: Number(data.month),
        items,
        notes: data.notes,
      })
    );
  };

  // Open the version-history panel for a given month.
  const openHistory = useCallback(
    (month) => {
      setHistoryMonth(month);
      dispatch(fetchEntryHistory({ year, month }));
    },
    [dispatch, year]
  );

  const closeHistory = useCallback(() => {
    setHistoryMonth(null);
    dispatch(clearHistory());
  }, [dispatch]);

  // While the history pop-up is open: let the Escape key close it, and stop the
  // page behind it from scrolling. Both are small things people expect from a
  // pop-up, and without them the panel feels broken.
  useEffect(() => {
    if (!historyMonth) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") closeHistory();
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [historyMonth, closeHistory]);

  // How much of the year has been filled in, as a percentage, for the bar in the
  // hero. 12 months is a full year, so the maths is deliberately simple.
  const completionPct = Math.round((summary.recordedCount / MONTHS_IN_YEAR) * 100);

  return (
    <div className="space-y-6">
      {/* ── Hero header ────────────────────────────────────────────────────────
          Same green banner as the dashboard, so moving between the two pages
          feels like staying inside one application. */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 px-6 py-7 text-white shadow-sm">
        {/* Decorative blurred circles for a bit of depth. */}
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-teal-300/20 blur-2xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-emerald-100">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15">
                {icons.recycle}
              </span>
              {t("wasteEntries.eyebrow")}
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">{t("wasteEntries.title")}</h1>
            <p className="mt-1 max-w-2xl text-sm text-emerald-100">
              {canWrite
                ? t("wasteEntries.subtitleWrite")
                : t("wasteEntries.subtitleRead")}
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
            {/* Year control, styled to sit on the dark green background. */}
            <label className="flex items-center gap-2 text-sm">
              <span className="text-emerald-100">{t("common.year")}</span>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-lg border border-white/25 bg-white/15 px-3 py-2 text-sm text-white backdrop-blur transition focus:outline-none focus:ring-2 focus:ring-white/50 [&>option]:text-slate-900"
              >
                {recentYears().map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>

            {/* How many of the 12 months have figures yet. */}
            <div className="w-56">
              <div className="flex items-center justify-between text-xs text-emerald-100">
                <span>{t("wasteEntries.monthsRecorded")}</span>
                <span className="font-semibold text-white">
                  {summary.recordedCount} / {MONTHS_IN_YEAR}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white transition-all duration-500"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {submitError && <AlertBanner level="error">{submitError}</AlertBanner>}

      {/* ── Year at a glance ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          icon={icons.scale}
          label={t("wasteEntries.metrics.totalYear", { year })}
          value={formatNumber(summary.grandTotal)}
          accent="emerald"
        />
        <MetricCard
          icon={icons.calendarCheck}
          label={t("wasteEntries.metrics.monthsRecorded")}
          value={`${summary.recordedCount}/${MONTHS_IN_YEAR}`}
          hint={t("wasteEntries.metrics.pctOfYear", { pct: completionPct })}
          accent="violet"
        />
        <MetricCard
          icon={icons.clock}
          label={t("wasteEntries.metrics.notRecordedYet")}
          value={formatNumber(summary.missingMonths.length)}
          hint={
            summary.missingMonths.length === 0
              ? t("wasteEntries.metrics.fullYearCaptured")
              : t("wasteEntries.metrics.monthsStillBlank")
          }
          accent={summary.missingMonths.length > 0 ? "amber" : "emerald"}
        />
        <MetricCard
          icon={icons.layers}
          label={t("wasteEntries.metrics.largestCategory")}
          value={
            summary.topCategory ? categoryLabel(summary.topCategory.key) : t("common.empty")
          }
          hint={
            summary.topCategory
              ? `${formatNumber(summary.categoryTotals[summary.topCategory.key])} ${t("common.kg")}`
              : t("wasteEntries.metrics.noFiguresYet")
          }
          accent="blue"
        />
      </div>

      {/* ── Record / correct a month ──────────────────────────────────────────
          Only shown to people who may write. For a read-only role (auditor) the
          page starts straight at the 12-month grid below. */}
      {canWrite && (
        <Card className="p-6">
          <SectionTitle
            icon={icons.pencil}
            hint={t("wasteEntries.form.hint")}
            right={
              entryByMonth[selectedMonth] ? (
                <Badge tone="blue">
                  {t("wasteEntries.form.currentVersion", {
                    version: entryByMonth[selectedMonth].version,
                  })}
                </Badge>
              ) : (
                <Badge tone="amber">{t("wasteEntries.form.notRecordedYet")}</Badge>
              )
            }
          >
            {t("wasteEntries.form.title")}
          </SectionTitle>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  {t("common.month")}
                </label>
                <select className={inputClass + " w-44"} {...register("month")}>
                  {monthNames.map((name, idx) => (
                    <option key={idx} value={idx + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick jump buttons for the months that are still blank. Clicking
                  one simply picks that month in the dropdown above, which saves
                  hunting through the list to find what is missing. */}
              {summary.missingMonths.length > 0 && (
                <div className="min-w-0 flex-1">
                  <div className="mb-1 text-xs font-medium text-slate-500">
                    {t("wasteEntries.form.stillBlank")}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {summary.missingMonths.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setValue("month", m)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                          selectedMonth === m
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-white text-slate-500 hover:border-emerald-300 hover:text-emerald-700"
                        }`}
                      >
                        {monthNames[m - 1].slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* One box per kind of waste. Each box carries its category's colour
                so the form and the table below read as the same five things. */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {WASTE_CATEGORIES.map((cat) => {
                const color = CATEGORY_COLORS[cat.key] || "#64748b";
                // The name shown on the box comes from the language files; the code
                // sent to the server is always cat.key.
                const label = categoryLabel(cat.key);
                return (
                  <div
                    key={cat.key}
                    className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 transition hover:border-slate-300"
                  >
                    <label
                      htmlFor={`w_${cat.key}`}
                      className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-600"
                    >
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
                        style={{ background: `${color}1a`, color }}
                      >
                        {CATEGORY_ICONS[cat.key]}
                      </span>
                      <span className="truncate" title={label}>
                        {label}
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        id={`w_${cat.key}`}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0"
                        aria-label={t("wasteEntries.form.kgAriaLabel", { category: label })}
                        className={inputClass + " pr-9 text-right font-medium tabular-nums"}
                        {...register(`w_${cat.key}`)}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">
                        {t("common.kg")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <label
                htmlFor="notes"
                className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500"
              >
                <span className="text-slate-400">{icons.note}</span>
                {t("wasteEntries.form.notes")}
              </label>
              <input
                id="notes"
                className={inputClass}
                placeholder={t("wasteEntries.form.notesPlaceholder")}
                {...register("notes")}
              />
            </div>

            <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
              <Button type="submit" disabled={submitting} className="inline-flex items-center gap-2">
                {submitting ? icons.spinner : icons.save}
                {submitting ? t("common.saving") : t("wasteEntries.form.save")}
              </Button>
              <span className="text-xs text-slate-400">
                {t("wasteEntries.form.savingHint", {
                  month: monthNames[selectedMonth - 1],
                  year,
                })}
              </span>
            </div>
          </form>
        </Card>
      )}

      {/* ── The 12-month grid ───────────────────────────────────────────────── */}
      {loading ? (
        <Loader label={t("wasteEntries.loading")} />
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 pt-5">
            <SectionTitle
              icon={icons.grid}
              hint={t("wasteEntries.table.hint", { count: summary.recordedCount })}
              right={
                <span className="text-xs text-slate-400">
                  {t("wasteEntries.table.allWeightsInKg")}
                </span>
              }
            >
              {t("wasteEntries.table.title", { year })}
            </SectionTitle>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-slate-500">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">
                    {t("common.month")}
                  </th>
                  {WASTE_CATEGORIES.map((c) => (
                    <th
                      key={c.key}
                      className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {/* A colour dot ties this column to the matching box in
                            the form above. */}
                        <span
                          className="inline-block h-2 w-2 rounded-sm"
                          style={{ background: CATEGORY_COLORS[c.key] || "#64748b" }}
                        />
                        {categoryLabel(c.key)}
                      </span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                    {t("common.total")}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                    {t("common.status")}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                    {t("wasteEntries.table.history")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {monthNames.map((name, idx) => {
                  const month = idx + 1;
                  const entry = entryByMonth[month];
                  const map = itemsToMap(entry?.items);
                  // How wide the little bar under the total should be, compared
                  // with the heaviest month of the year.
                  const barPct =
                    entry && summary.biggestMonthKg > 0
                      ? Math.max(
                          4,
                          Math.round((Number(entry.totalWeightKg || 0) / summary.biggestMonthKg) * 100)
                        )
                      : 0;
                  return (
                    <tr
                      key={month}
                      className={`border-b border-slate-100 transition-colors last:border-0 hover:bg-emerald-50/40 ${
                        entry ? "" : "bg-slate-50/40 text-slate-400"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {/* A small square with the month number keeps the first
                              column easy to scan from top to bottom. */}
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                              entry
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-400"
                            }`}
                          >
                            {month}
                          </span>
                          <span className={entry ? "font-medium text-slate-700" : "text-slate-400"}>
                            {name}
                          </span>
                        </div>
                      </td>
                      {WASTE_CATEGORIES.map((c) => (
                        <td
                          key={c.key}
                          className="px-4 py-3 text-right tabular-nums text-slate-600"
                        >
                          {entry ? formatNumber(map[c.key] ?? 0) : t("common.empty")}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right">
                        {entry ? (
                          <div className="inline-flex flex-col items-end gap-1">
                            <span className="font-semibold tabular-nums text-slate-900">
                              {formatNumber(entry.totalWeightKg)}
                            </span>
                            <span className="block h-1 w-20 overflow-hidden rounded-full bg-slate-100">
                              <span
                                className="block h-full rounded-full bg-emerald-500"
                                style={{ width: `${barPct}%` }}
                              />
                            </span>
                          </div>
                        ) : (
                          t("common.empty")
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {entry ? (
                          <Badge tone={entry.version > 1 ? "blue" : "green"}>
                            {entry.version > 1
                              ? t("wasteEntries.table.corrected", { version: entry.version })
                              : t("wasteEntries.table.recorded")}
                          </Badge>
                        ) : (
                          <Badge tone="slate">{t("wasteEntries.table.blank")}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {entry ? (
                          <button
                            onClick={() => openHistory(month)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                          >
                            {icons.clock}
                            {t("common.view")}
                          </button>
                        ) : (
                          t("common.empty")
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* A totals row so the year adds up in front of the user, without
                  having to add the twelve rows in their head. */}
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 text-slate-700">
                  <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">
                    {t("wasteEntries.table.yearTotal")}
                  </td>
                  {WASTE_CATEGORIES.map((c) => (
                    <td
                      key={c.key}
                      className="px-4 py-3 text-right font-semibold tabular-nums"
                    >
                      {formatNumber(summary.categoryTotals[c.key])}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900">
                    {formatNumber(summary.grandTotal)}
                  </td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* ── Version history panel ───────────────────────────────────────────── */}
      {historyMonth && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t("wasteEntries.history.title", {
            month: monthNames[historyMonth - 1],
            year,
          })}
          // Clicking the dark area outside the panel closes it.
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeHistory();
          }}
        >
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  {icons.clock}
                </span>
                <div>
                  <div className="font-semibold text-slate-900">
                    {monthNames[historyMonth - 1]} {year}
                  </div>
                  <div className="text-xs text-slate-500">
                    {t("wasteEntries.history.subtitle")}
                  </div>
                </div>
              </div>
              <button
                onClick={closeHistory}
                aria-label={t("wasteEntries.history.close")}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-700"
              >
                {icons.close}
              </button>
            </div>

            <div className="overflow-y-auto p-6">
              {historyLoading ? (
                <Loader label={t("wasteEntries.history.loading")} />
              ) : history.length === 0 ? (
                <p className="text-sm text-slate-500">{t("wasteEntries.history.none")}</p>
              ) : (
                // Drawn as a timeline: a line down the left with one dot per
                // version, newest at the top.
                <ol className="relative space-y-4 border-l border-slate-200 pl-6">
                  {history.map((v) => (
                    <li key={v._id} className="relative">
                      <span
                        className={`absolute -left-[31px] top-4 h-3 w-3 rounded-full ring-4 ring-white ${
                          v.isLatest ? "bg-emerald-500" : "bg-slate-300"
                        }`}
                      />
                      <div
                        className={`rounded-xl border p-4 transition ${
                          v.isLatest
                            ? "border-emerald-200 bg-emerald-50/40"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <Badge tone={v.isLatest ? "green" : "slate"}>
                            v{v.version} {v.isLatest ? t("wasteEntries.history.current") : ""}
                          </Badge>
                          <span className="text-xs text-slate-400">
                            {formatDateTime(v.createdAt)}
                          </span>
                        </div>

                        {/* Each waste line as its own small chip, coloured to
                            match its category everywhere else on the page. */}
                        <div className="flex flex-wrap gap-1.5">
                          {v.items.map((it) => {
                            const color = CATEGORY_COLORS[it.category] || "#64748b";
                            // categoryLabel() falls back to showing the key itself if
                            // a code arrives that we have no wording for, so a new
                            // backend category still appears instead of vanishing.
                            const label = categoryLabel(it.category);
                            return (
                              <span
                                key={it.category}
                                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600"
                              >
                                <span
                                  className="inline-block h-2 w-2 rounded-sm"
                                  style={{ background: color }}
                                />
                                {label}
                                <span className="font-semibold tabular-nums text-slate-900">
                                  {formatNumber(it.weightKg)} {t("common.kg")}
                                </span>
                              </span>
                            );
                          })}
                        </div>

                        <div className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                          <span className="text-emerald-600">{icons.check}</span>
                          {t("wasteEntries.history.total", {
                            kg: formatNumber(v.totalWeightKg),
                          })}
                        </div>

                        {v.notes && (
                          <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                            <span className="mt-0.5 shrink-0 text-slate-400">{icons.note}</span>
                            {v.notes}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
