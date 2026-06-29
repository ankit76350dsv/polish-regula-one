/**
 * Translator between the backend's data shape and the shape the UI expects.
 *
 * WHY THIS EXISTS:
 * The backend stores values as enum NAMES ("INVESTIGATING", "CRITICAL", "CORRUPTION")
 * and dates as full ISO timestamps ("2026-05-12T11:24:00Z"). The whole SafeVoice UI,
 * however, was built around friendly display strings ("Investigating", "Critical",
 * "Corruption") and short, readable dates ("2026-05-12 11:24"). Rather than change
 * every screen, badge, filter, and translation key, we convert the data ONCE here, in
 * the service layer, so components keep speaking the same friendly language as before.
 *
 * It works in both directions:
 *   • normalizeReport / normalizeMessage — backend → UI (used when reading).
 *   • statusToApi / severityToApi         — UI → backend enum name (used when writing).
 */

// ── Enum name ⇆ display string maps ──────────────────────────────────────────
// Each pair is "BACKEND_ENUM_NAME": "Friendly Display". We build the reverse map
// automatically so we never get the two directions out of step.

const STATUS_LABELS = {
  RECEIVED: "Received",
  ACKNOWLEDGED: "Acknowledged",
  TRIAGE: "Triage",
  INVESTIGATING: "Investigating",
  AWAITING_REPORTER: "Awaiting Reporter",
  REMEDIATION: "Remediation",
  CLOSED: "Closed",
};

const SEVERITY_LABELS = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

const CATEGORY_LABELS = {
  CORRUPTION: "Corruption",
  FRAUD: "Fraud",
  PUBLIC_PROCUREMENT: "Public Procurement",
  AML: "AML / Terrorist Financing",
  PRODUCT_SAFETY: "Product Safety",
  ENVIRONMENTAL: "Environmental Protection",
  CONSUMER_PROTECTION: "Consumer Protection",
  DATA_PROTECTION: "Privacy / Personal Data",
  CYBERSECURITY: "Network & Information Security",
  HEALTH_SAFETY: "Public Health / Safety",
  DISCRIMINATION: "Discrimination",
  HARASSMENT: "Harassment",
  LABOUR_DISPUTE: "Individual HR Grievance",
  OTHER: "Other",
};

const DISCLOSURE_LABELS = {
  ANONYMOUS: "Anonymous",
  CONFIDENTIAL_NAMED: "Confidential Named",
  HR_HANDOFF: "HR Handoff",
};

const INTAKE_LABELS = {
  ANONYMOUS_WEB_PORTAL: "Anonymous web portal",
  CONFIDENTIAL_NAMED_PORTAL: "Confidential named portal",
  HR_GRIEVANCE_HANDOFF: "HR grievance handoff",
};

const RETENTION_LABELS = {
  ACTIVE: "Active",
  LEGAL_HOLD: "Legal Hold",
  SCHEDULED_DELETION: "Scheduled Deletion",
  DELETED: "Deleted",
};

// Flip a {name: label} map into {label: name} for the write direction.
function invert(map) {
  return Object.fromEntries(Object.entries(map).map(([name, label]) => [label, name]));
}

const STATUS_NAMES = invert(STATUS_LABELS);
const SEVERITY_NAMES = invert(SEVERITY_LABELS);

// Turn one enum name into its display string. If the backend ever sends something we
// do not know (or already a friendly string), we just pass it through unchanged so
// nothing breaks — the UI shows the raw value rather than blank.
function labelFrom(map, value) {
  if (value == null) return value;
  return map[value] ?? value;
}

// ── Timestamp formatting ──────────────────────────────────────────────────────
// Pad a number to two digits ("9" → "09").
function pad(n) {
  return String(n).padStart(2, "0");
}

/**
 * Turn an ISO timestamp (or epoch number) into the short "YYYY-MM-DD HH:mm" the UI
 * shows. Returns null for empty values and passes through anything unparseable, so a
 * surprising value can never crash a page.
 */
export function formatTimestamp(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value; // not a date we understand — show as-is
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Date-only version ("YYYY-MM-DD") for the incident date field.
export function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ── Public mappers ────────────────────────────────────────────────────────────

// UI display string → backend enum name (for status/severity update calls).
export function statusToApi(displayValue) {
  return STATUS_NAMES[displayValue] ?? displayValue;
}

export function severityToApi(displayValue) {
  return SEVERITY_NAMES[displayValue] ?? displayValue;
}

/**
 * Convert one backend message into the shape the chat UI expects (friendly timestamp).
 */
export function normalizeMessage(raw) {
  if (!raw) return raw;
  return {
    ...raw,
    timestamp: formatTimestamp(raw.timestamp),
  };
}

/**
 * Convert one backend case report into the shape every staff/reporter screen expects:
 * friendly enum labels and short dates. Unknown/missing values are left untouched.
 */
export function normalizeReport(raw) {
  if (!raw) return raw;
  const retention = raw.retention || {};
  return {
    ...raw,
    category: labelFrom(CATEGORY_LABELS, raw.category),
    status: labelFrom(STATUS_LABELS, raw.status),
    severity: labelFrom(SEVERITY_LABELS, raw.severity),
    disclosureMode: labelFrom(DISCLOSURE_LABELS, raw.disclosureMode),
    intakeChannel: labelFrom(INTAKE_LABELS, raw.intakeChannel),
    incidentDate: formatDate(raw.incidentDate),
    submissionDate: formatTimestamp(raw.submissionDate),
    acknowledgementDue: formatTimestamp(raw.acknowledgementDue),
    feedbackDue: formatTimestamp(raw.feedbackDue),
    // Keep retention present so the detail page never reads from undefined, and make
    // its dates/state friendly too.
    retention: {
      ...retention,
      state: labelFrom(RETENTION_LABELS, retention.state),
      deleteAfter: formatDate(retention.deleteAfter),
      irrelevantPersonalDataDeletionDue: formatDate(retention.irrelevantPersonalDataDeletionDue),
    },
    // Timeline events carry their own timestamps — make those readable as well.
    timeline: Array.isArray(raw.timeline)
      ? raw.timeline.map((e) => ({ ...e, timestamp: formatTimestamp(e.timestamp) }))
      : [],
  };
}

// Normalize a whole list of reports.
export function normalizeReports(list) {
  return Array.isArray(list) ? list.map(normalizeReport) : [];
}

// Normalize a whole list of messages.
export function normalizeMessages(list) {
  return Array.isArray(list) ? list.map(normalizeMessage) : [];
}
