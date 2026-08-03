// Small shared formatting helpers used across WorkPulse pages.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THESE TAKE EXTRA ARGUMENTS
// ─────────────────────────────────────────────────────────────────────────────
// The app can be shown in Polish or English, and these helpers produce text the
// user reads. So they cannot hard-code English:
//   - "8h 30m" must become "8 godz. 30 min" in Polish,
//   - "30 Jul 2026" must become "30 lip 2026",
//   - "Missing break" must become "Brak przerwy".
//
// These functions are plain functions, not React components, so they cannot call
// the translation hook themselves. Instead:
//   - the ones that format NUMBERS and DATES take the unit words / locale as
//     arguments,
//   - the ones that produce a LABEL return a translation KEY (labelKey) and let
//     the calling component turn it into words.
//
// Nothing calls these directly any more — components use the useFormat() hook
// (src/hooks/useFormat.js), which fills in the language for you. These are kept
// separate so the logic stays testable without React.

// Turn a number of minutes into a friendly duration string.
//
// The unit words are passed in so the same function works in both languages:
//   formatDuration(510, "h", "m")          -> "8h 30m"
//   formatDuration(510, "godz.", "min")    -> "8 godz. 30 min"
export function formatDuration(minutes, hourLabel = "h", minuteLabel = "m") {
  const safe = Math.max(0, Math.round(minutes || 0));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}${hourLabel === "h" ? "" : " "}${hourLabel} ${m}${
    minuteLabel === "m" ? "" : " "
  }${minuteLabel}`;
}

// Format a date/time as a short local time (e.g. "09:05").
// `locale` decides the formatting rules — "pl-PL" or "en-GB".
export function formatTime(value, locale) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Format a date as a short local date (e.g. "30 Jul 2026" / "30 lip 2026").
export function formatDate(value, locale) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Format a full date + time (used in audit/timeline views).
export function formatDateTime(value, locale) {
  if (!value) return "—";
  return new Date(value).toLocaleString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// A colour + translation key for each break-compliance status (art. 134).
// The caller turns `labelKey` into words with t().
export function breakStatusMeta(status) {
  switch (status) {
    case "COMPLIANT":
      return {
        labelKey: "breakStatus.compliant",
        cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    case "SHORT_BREAK":
      return {
        labelKey: "breakStatus.short",
        cls: "bg-amber-50 text-amber-700 border-amber-200",
      };
    case "MISSING_BREAK":
      return {
        labelKey: "breakStatus.missing",
        cls: "bg-red-50 text-red-700 border-red-200",
      };
    default:
      return {
        labelKey: "breakStatus.notNeeded",
        cls: "bg-slate-50 text-slate-500 border-slate-200",
      };
  }
}

// A colour + translation key for each time-entry lifecycle status.
//
// An unknown status has no translation to offer, so `labelKey` is null and the
// raw value is returned in `fallback` — better to show the code we received than
// an empty badge, because it tells support exactly what the server sent.
export function entryStatusMeta(status) {
  switch (status) {
    case "OPEN":
      return {
        labelKey: "entryStatus.open",
        cls: "bg-indigo-50 text-indigo-700 border-indigo-200",
      };
    case "ON_BREAK":
      return {
        labelKey: "entryStatus.onBreak",
        cls: "bg-amber-50 text-amber-700 border-amber-200",
      };
    case "COMPLETED":
      return {
        labelKey: "entryStatus.completed",
        cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    case "MISSING_CLOCK_OUT":
      return {
        labelKey: "entryStatus.missingClockOut",
        cls: "bg-red-50 text-red-700 border-red-200",
      };
    case "AUTO_CLOSED":
      return {
        labelKey: "entryStatus.autoClosed",
        cls: "bg-slate-100 text-slate-600 border-slate-200",
      };
    default:
      return {
        labelKey: null,
        fallback: status || "—",
        cls: "bg-slate-50 text-slate-500 border-slate-200",
      };
  }
}

// The absence types the backend can send. The order here is the order the
// dropdown on the Absences page shows them in.
//
// Only the CODES live here — the words for each one live in the language files
// under "absenceType", so the list never has to be translated twice.
export const ABSENCE_TYPES = [
  "ANNUAL_LEAVE",
  "ON_DEMAND_LEAVE",
  "SICK_LEAVE",
  "UNPAID_LEAVE",
  "MATERNITY_LEAVE",
  "CHILDCARE_LEAVE",
  "SPECIAL_LEAVE",
  "PUBLIC_HOLIDAY",
  "OTHER",
];
