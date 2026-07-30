// Turning stored audit data into something a person can read.
//
// The audit trail is written by the server in the server's own vocabulary: actions are
// enum names ("UPDATE"), record kinds are codes ("audit_trail"), and the before/after
// values are maps keyed by field name ("retentionPeriod"). That is exactly right for
// storage — it must stay stable for ten years — but it is not what an auditor, a lawyer or
// a data protection officer should be shown.
//
// This module is the one place that translates it. Nothing here changes what is stored.

import {
  ART6_BASES, ART9_CONDITIONS, DATA_CATEGORIES, DATA_SUBJECT_CATEGORIES, DEPARTMENTS,
  DSAR_TYPES, RECIPIENT_CATEGORIES, TOMS, TRANSFER_MECHANISMS,
} from './gdpr';

// A stored field name → an existing dictionary key, so the audit trail names a field
// exactly the way the screen that changed it does. Anything not listed falls back to
// humanise() below, so a new field never shows up as an error — just less polished.
const FIELD_KEYS = {
  name: 'ropa.name',
  purpose: 'ropa.purpose',
  status: 'common.status',
  lawfulBasis: 'ropa.lawfulBasis',
  retentionPeriod: 'ropa.retention',
  retentionBasis: 'ropa.retentionBasis',
  dpiaVerdict: 'audit.field.dpiaVerdict',
  role: 'ropa.role',
  // Data subject requests
  requester: 'dsar.requester',
  requesterName: 'dsar.requester',
  relation: 'dsar.relation',
  notes: 'dsar.notes',
  identityMethod: 'dsar.identityMethod',
  type: 'dsar.type',
  // Processors and transfers
  country: 'vendors.country',
  region: 'vendors.hosting',
  dpaStatus: 'vendors.dpaStatus',
  subprocessors: 'vendors.subprocessors',
  lastReviewAt: 'vendors.lastReview',
  riskLevel: 'risk.level',
  recipient: 'transfers.recipient',
  destinationCountry: 'transfers.destination',
  mechanism: 'transfers.mechanism',
  tiaDocumented: 'transfers.tia',
  // Breaches
  riskRationale: 'breach.riskRationale',
  identityVerified: 'audit.field.identityVerified',
  tasks: 'audit.field.tasks',
  extended: 'audit.field.extended',
  dueAt: 'common.deadline',
  refusalReason: 'dsar.refuseReason',
  uodoNotifiedAt: 'breach.uodoNotified',
  subjectsNotifiedAt: 'breach.subjectsNotified',
  criteriaMatched: 'dpia.screening',
  version: 'audit.field.version',
  audience: 'notices.audience',
  'dpo.name': 'audit.field.dpoName',
  'dpo.email': 'audit.field.dpoEmail',
  'dpo.phone': 'audit.field.dpoPhone',
  'dpo.appointedAt': 'audit.field.dpoAppointedAt',
  'dpo.uodoNotifiedAt': 'audit.field.dpoUodoNotifiedAt',
  'dpo.publishedOnWebsite': 'audit.field.dpoPublished',
  'ai.enabled': 'audit.field.aiEnabled',
  'ai.excludeSpecialCategories': 'audit.field.aiExclude',
  // Exports
  format: 'audit.field.format',
  target: 'audit.field.target',
  itemCount: 'audit.field.itemCount',
  filters: 'audit.field.filters',
};

// Values that are really enum codes get the label the rest of the app uses. Tried in
// order; the first dictionary hit wins. Handles both "APPROVED" and "approved", because
// different services snapshot enums differently.
const VALUE_KEY_PATTERNS = [
  (v) => `status.${v}`,
  (v) => `dpia.verdict.${v}`,
  (v) => `risk.${v}`,
  (v) => `vendors.dpa.${v}`,
  (v) => `audit.target.${v}`,
  (v) => `audit.format.${v}`,
];

// The shared reference lists, searched by id, so a stored code like "CONSENT" or "identity"
// reads as the same words the form that set it showed.
const VALUE_LISTS = [
  ART6_BASES, ART9_CONDITIONS, DATA_CATEGORIES, DATA_SUBJECT_CATEGORIES,
  RECIPIENT_CATEGORIES, TOMS, DEPARTMENTS, TRANSFER_MECHANISMS, DSAR_TYPES,
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;

/** "retentionPeriod" → "Retention period"; "dpo.email" → "DPO · email". */
function humanise(key) {
  return String(key)
    .split('.')
    .map((part) => part
      // camelCase → separate words
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .trim()
      // Only the first word of a part is capitalised: "identityVerified" should read
      // "Identity verified", not "Identity Verified".
      .toLowerCase())
    .map((part, index) => {
      // Keep well-known initialisms upper-case rather than "Dpo" / "Ai".
      const upper = part.toUpperCase();
      if (['DPO', 'AI', 'DPA', 'TIA', 'ID'].includes(upper)) return upper;
      return index === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part.toLowerCase();
    })
    .join(' · ');
}

/** What happened — "UPDATE" → "Changed". */
export function auditActionLabel(action, t) {
  if (!action) return '—';
  const label = t(`audit.action.${action}`);
  return label === `audit.action.${action}` ? humanise(action) : label;
}

/** Which kind of record — "audit_trail" → "Audit trail". */
export function auditEntityLabel(entityType, t) {
  if (!entityType) return '—';
  const label = t(`audit.entityType.${entityType}`);
  return label === `audit.entityType.${entityType}` ? humanise(entityType) : label;
}

/** The name of one changed field, in the same words the screen uses. */
export function auditFieldLabel(field, t) {
  const mapped = FIELD_KEYS[field];
  if (mapped) {
    const label = t(mapped);
    if (label !== mapped) return label;
  }
  return humanise(field);
}

/**
 * One stored value, written out. Booleans become yes/no, dates are formatted for the
 * reader's country, lists are joined, and codes that the app has a label for use it.
 */
export function auditValueText(value, lang, t) {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no');
  if (Array.isArray(value)) {
    return value.length === 0 ? '—' : value.map((v) => auditValueText(v, lang, t)).join(', ');
  }
  if (typeof value === 'object') {
    // Nested objects are rare in a snapshot; show them as "key: value" pairs rather than
    // as braces and quotes.
    return Object.entries(value)
      .map(([k, v]) => `${auditFieldLabel(k, t)}: ${auditValueText(v, lang, t)}`)
      .join('; ');
  }
  const text = String(value);
  if (ISO_DATE.test(text)) {
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) {
      return text.includes('T')
        ? date.toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' })
        : date.toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-GB');
    }
  }
  // An enum code the app already has wording for?
  const lower = text.toLowerCase();
  for (const pattern of VALUE_KEY_PATTERNS) {
    const key = pattern(lower);
    const label = t(key);
    if (label !== key) return label;
  }
  for (const list of VALUE_LISTS) {
    const entry = list.find((x) => x.id === lower);
    if (entry?.[lang]) return entry[lang];
  }
  return text;
}

/**
 * The changed fields of one entry, as rows ready to render:
 * [{ field, label, before, after }]
 *
 * The panel used to print JSON.stringify of the whole map. Pairing before with after per
 * field is what an auditor actually needs — "what did this value used to be?" — instead of
 * two blocks of braces to compare by eye.
 */
export function auditChangeRows(entry, lang, t) {
  const before = entry?.oldValue ?? {};
  const after = entry?.newValue ?? {};
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return fields.map((field) => ({
    field,
    label: auditFieldLabel(field, t),
    before: field in before ? auditValueText(before[field], lang, t) : null,
    after: field in after ? auditValueText(after[field], lang, t) : null,
  }));
}
