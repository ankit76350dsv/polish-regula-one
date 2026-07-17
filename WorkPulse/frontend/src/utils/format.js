// Small shared formatting helpers used across WorkPulse pages.

// Turn a number of minutes into a friendly "Xh Ym" string.
export function formatDuration(minutes) {
  const safe = Math.max(0, Math.round(minutes || 0));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}h ${m}m`;
}

// Format a date/time as a short local time (e.g. "09:05").
export function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Format a date as a short local date (e.g. "9 Jul 2026").
export function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

// Format a full date + time (used in audit/timeline views).
export function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// A colour + label for each break-compliance status.
export function breakStatusMeta(status) {
  switch (status) {
    case "COMPLIANT":
      return { label: "Break OK", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "SHORT_BREAK":
      return { label: "Short break", cls: "bg-amber-50 text-amber-700 border-amber-200" };
    case "MISSING_BREAK":
      return { label: "Missing break", cls: "bg-red-50 text-red-700 border-red-200" };
    default:
      return { label: "No break needed", cls: "bg-slate-50 text-slate-500 border-slate-200" };
  }
}

// A colour + label for each time-entry lifecycle status.
export function entryStatusMeta(status) {
  switch (status) {
    case "OPEN":
      return { label: "Working", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" };
    case "ON_BREAK":
      return { label: "On break", cls: "bg-amber-50 text-amber-700 border-amber-200" };
    case "COMPLETED":
      return { label: "Completed", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "MISSING_CLOCK_OUT":
      return { label: "Missing clock-out", cls: "bg-red-50 text-red-700 border-red-200" };
    case "AUTO_CLOSED":
      return { label: "Auto-closed", cls: "bg-slate-100 text-slate-600 border-slate-200" };
    default:
      return { label: status || "—", cls: "bg-slate-50 text-slate-500 border-slate-200" };
  }
}

// Friendly labels for absence types (English + Polish name).
export const ABSENCE_TYPE_LABELS = {
  ANNUAL_LEAVE: "Annual leave (urlop wypoczynkowy)",
  ON_DEMAND_LEAVE: "On-demand leave (urlop na żądanie)",
  SICK_LEAVE: "Sick leave (L4)",
  UNPAID_LEAVE: "Unpaid leave (urlop bezpłatny)",
  MATERNITY_LEAVE: "Maternity/parental (macierzyński)",
  CHILDCARE_LEAVE: "Childcare (wychowawczy)",
  SPECIAL_LEAVE: "Special leave (okolicznościowy)",
  PUBLIC_HOLIDAY: "Public holiday",
  OTHER: "Other",
};
