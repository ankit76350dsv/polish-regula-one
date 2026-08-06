// Shared front-end constants. Keeping these in one file mirrors the backend's
// single-source-of-truth approach and keeps the pages consistent.

// The waste categories — the KEYS MUST match the backend's utils/wasteCategories.js
// and the codes used in the BDO XML. The ORDER here is the order every list, form
// and table on every page shows them in, so the five things always read the same
// way round.
//
// WHAT CHANGED AND WHY: each entry used to carry its own wording, in two fields —
// `label` (English) and `labelPl` (Polish). That was removed. The problem was that
// nothing chose between them: the pages all showed `label`, so the Polish wording
// sat in the file unused, and the Thresholds page printed BOTH one under the other
// because that was the only way to get the Polish word on screen at all. Adding a
// third language would have meant a third field and touching every page again.
//
// The wording now lives in the language files (i18n/pl.js and i18n/en.js) under
// `categories`, and a page asks for it with the categoryLabel() helper from
// useTranslation. This file keeps only what is genuinely a constant — the codes and
// their order — and the wording follows whichever language the user picked.
export const WASTE_CATEGORIES = [
  { key: "PAPER" },
  { key: "PLASTIC" },
  { key: "GLASS" },
  { key: "METAL" },
  { key: "MIXED" },
];

// How many months a reporting year has. Used for the "x of 12 months" counters and
// the completion bar.
//
// The month NAMES used to live here as an English array (MONTH_NAMES). They were
// removed for the same reason as the category labels above: an English-only list
// cannot serve a Polish app. The names now come from the language files, as the
// `monthNames` array returned by useTranslation, so this file only needs to say how
// many there are.
export const MONTHS_IN_YEAR = 12;

// A short list of recent years for the year picker (current year and the 4 before).
export const recentYears = () => {
  const now = new Date().getFullYear();
  return [now, now - 1, now - 2, now - 3, now - 4];
};

// Today's date in Poland, as { year, month, day } with month 1-12.
// We ask for the Warsaw date explicitly rather than using the browser's own
// clock, because BDO deadlines are Polish legal dates — someone opening the app
// from another country must still see the Polish filing year.
const todayInPoland = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { year: get("year"), month: get("month"), day: get("day") };
};

// Which year should a work page open on?
//
// The BDO annual report is due 15 MARCH and covers the PREVIOUS calendar year.
// So between 1 January and 15 March the job in front of the user is finishing
// LAST year — checking its months are complete and filing it. Opening those
// pages on the current year during that window meant the user had to notice the
// mismatch and change the dropdown themselves, which is exactly the kind of
// quiet mistake that ends in a late filing.
//
// Outside that window there is nothing to file yet, so the current year (the one
// being recorded month by month) is the useful default.
//
// The backend works the deadline out independently in utils/bdoDeadlines.js and
// is the authority on whether anything is actually overdue — this is only which
// year the picker starts on.
export const defaultReportingYear = () => {
  const { year, month, day } = todayInPoland();
  const beforeFilingDeadline = month < 3 || (month === 3 && day <= 15);
  return beforeFilingDeadline ? year - 1 : year;
};

// Colours used by the charts so every chart looks consistent.
export const CATEGORY_COLORS = {
  PAPER: "#2563eb",
  PLASTIC: "#16a34a",
  GLASS: "#0891b2",
  METAL: "#9333ea",
  MIXED: "#d97706",
};
