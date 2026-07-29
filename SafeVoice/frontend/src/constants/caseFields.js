/**
 * Static reference data for whistleblower cases.
 *
 * These are NOT fake/server data — they are fixed lists the UI needs to build
 * dropdowns, badges, and colour styles (the category catalogue, the status and
 * severity options, and the Tailwind classes for each badge). They used to live
 * inside the mock database; they now live here so the UI keeps working after the
 * mock backend was removed.
 *
 * The VALUES below are the human-readable display strings. The backend speaks in
 * enum names (e.g. "INVESTIGATING"); the service layer (caseNormalizer.js) maps
 * between the two, so everything the UI touches stays in these friendly strings.
 */

// Catalogue of report categories. Each value is also a translation key under
// i18n "categories.*"; the visible text is translated, falling back to the value.
export const reportCategories = [
  "Corruption",
  "Fraud",
  "Public Procurement",
  "AML / Terrorist Financing",
  "Product Safety",
  "Environmental Protection",
  "Consumer Protection",
  "Privacy / Personal Data",
  "Network & Information Security",
  "Public Health / Safety",
  "Discrimination",
  "Harassment",
  "Individual HR Grievance",
  "Other",
];

// Categories that are individual labour disputes → handled by HR, NOT as
// anonymous whistleblower cases (no access key). Matches the EU Directive's
// material scope and the Polish Act.
export const HR_ONLY_CATEGORIES = ["Individual HR Grievance"];

// The lifecycle stages a case can be in (display order).
export const statusValues = [
  "Received",
  "Acknowledged",
  "Triage",
  "Investigating",
  "Awaiting Reporter",
  "Remediation",
  "Closed",
];

// The severity levels an investigator can assign.
export const severityValues = ["Low", "Medium", "High", "Critical"];

// Tailwind colour classes for each status badge.
export const statusClasses = {
  Received: "bg-sky-50 text-sky-700 border-sky-200",
  Acknowledged: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Triage: "bg-amber-50 text-amber-800 border-amber-200",
  Investigating: "bg-cyan-50 text-cyan-700 border-cyan-200",
  "Awaiting Reporter": "bg-violet-50 text-violet-700 border-violet-200",
  Remediation: "bg-teal-50 text-teal-700 border-teal-200",
  Closed: "bg-slate-100 text-slate-700 border-slate-300",
};

// Tailwind colour classes for each severity badge.
export const severityClasses = {
  Low: "bg-slate-100 text-slate-700 border-slate-300",
  Medium: "bg-sky-50 text-sky-700 border-sky-200",
  High: "bg-amber-50 text-amber-800 border-amber-200",
  Critical: "bg-rose-50 text-rose-700 border-rose-200",
};
