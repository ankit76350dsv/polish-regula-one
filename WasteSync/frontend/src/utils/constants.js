// Shared front-end constants. Keeping these in one file mirrors the backend's
// single-source-of-truth approach and keeps labels consistent across pages.

// The waste categories — MUST match the backend's utils/wasteCategories.js.
export const WASTE_CATEGORIES = [
  { key: "PAPER", label: "Paper & cardboard", labelPl: "Papier i tektura" },
  { key: "PLASTIC", label: "Plastic", labelPl: "Tworzywa sztuczne" },
  { key: "GLASS", label: "Glass", labelPl: "Szkło" },
  { key: "METAL", label: "Metal", labelPl: "Metale" },
  { key: "MIXED", label: "Mixed / multi-material", labelPl: "Wielomateriałowe" },
];

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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
