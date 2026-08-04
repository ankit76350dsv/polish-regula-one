// Builds the audit-trail CSV export (GDPR Art. 5(2) accountability evidence).
//
// WHO OPENS THIS FILE: an auditor, a company's lawyer, or an inspector from UODO. Not a
// developer. They open it in Excel and they must be able to answer "who changed this, when,
// and what did it used to say?" without anyone translating the product's internals for them.
//
// WHAT THIS FILE USED TO LOOK LIKE, and why each part was wrong:
//
//   • the before/after values were raw `JSON.stringify` of the stored maps, so a cell read
//     {"retentionPeriod":"5 years","status":"approved"} — braces, quotes, field names and
//     all. The reader was left to work out which field changed and to what.
//   • the action was the stored enum ("UPDATE"), the record kind was a code
//     ("audit_trail"), and the actor's role was a permission constant
//     ("PRIVACYPILOT_ADMIN"). None of those are words.
//   • headings were English only, and the delimiter was always a comma — so on a Polish
//     Excel the whole file landed in ONE column.
//   • times were ISO 8601 UTC ("2026-07-01T08:00:00Z"), which is precise but is not how a
//     person reads a timestamp.
//   • the browser was the full user-agent string, ~120 characters of version numbers.
//
// The app already knew how to say all of this in plain language — auditLabels.js does it for
// the on-screen "what changed" panel. This file now uses the SAME translator, so the export
// and the screen can never tell the reader different things.
//
// On the timestamp: it is now written the reader's way AND carries its time zone
// ("01.07.2026, 09:00 GMT+2"). Naming the zone is what keeps it unambiguous — which was the
// only reason to prefer raw UTC in the first place.
import { MULTI, dateTime, delimiterFor, joinCsv, rowOf } from './csv';
import { auditActionLabel, auditChangeRows, auditEntityLabel } from './auditLabels';
import { roleLabel } from './permissions';

// ── Wording ──────────────────────────────────────────────────────────────────────────
// Only ever seen inside the exported file, so it is kept here rather than in the app's i18n
// dictionary (which would imply it appears on screen).
const TEXT = {
  pl: {
    title: 'Rejestr audytowy — art. 5 ust. 2 RODO (rozliczalność)',
    exportedAt: 'Data eksportu',
    exportedBy: 'Eksportujący',
    receipt: 'Wpis potwierdzający ten eksport',
    filters: 'Zastosowane filtry',
    rowCount: 'Liczba wpisów w pliku',
    none: 'brak',
    // A one-line legend, because the arrow in the "what changed" column needs explaining
    // exactly once and nowhere else in the file.
    legend: 'Jak czytać: w kolumnie „Co się zmieniło” zapis „Pole: było → jest” '
      + 'pokazuje wartość przed zmianą i po zmianie. Znak „—” oznacza brak wartości.',
    noChanges: 'bez zmian wartości',
    headers: [
      'Lp.',
      'Data i godzina',
      'Kto (użytkownik)',
      'W jakiej roli',
      'Co zrobiono',
      'Rodzaj rekordu',
      'Którego rekordu dotyczy',
      'Co się zmieniło (było → jest)',
      'Adres IP',
      'Przeglądarka i system',
      'Numer referencyjny wpisu',
      'Pełne dane przeglądarki (informacja techniczna)',
    ],
  },
  en: {
    title: 'Audit trail — Art. 5(2) GDPR (accountability)',
    exportedAt: 'Exported',
    exportedBy: 'Exported by',
    receipt: 'Audit entry recording this export',
    filters: 'Filters applied',
    rowCount: 'Entries in this file',
    none: 'none',
    legend: 'How to read: in the "What changed" column, "Field: was → is" shows the value '
      + 'before and after the change. A "—" means there was no value.',
    noChanges: 'no values changed',
    headers: [
      'No.',
      'Date and time',
      'Who (user)',
      'Acting as',
      'What was done',
      'Type of record',
      'Which record',
      'What changed (was → is)',
      'IP address',
      'Browser and system',
      'Entry reference number',
      'Full browser details (technical)',
    ],
  },
};

/**
 * The user-agent string boiled down to something a person can read:
 * "Google Chrome (Windows)".
 *
 * The full string is still kept in its own clearly-labelled technical column, because for a
 * forensic question it is the evidence — this is the readable summary beside it, not a
 * replacement. Order matters below: Edge and Opera both also claim to be Chrome, and Chrome
 * also claims to be Safari.
 */
export function deviceSummary(userAgent) {
  const ua = String(userAgent ?? '');
  if (!ua) return '';
  const browser =
    /Edg[e/]/.test(ua) ? 'Microsoft Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Google Chrome'
    : /Firefox\//.test(ua) ? 'Mozilla Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : null;
  const system =
    /Windows NT/.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Linux/.test(ua) ? 'Linux'
    : null;
  if (!browser && !system) return ua; // something unusual — show it honestly rather than guess
  if (browser && system) return `${browser} (${system})`;
  return browser ?? system;
}

/**
 * What changed on one entry, as one readable cell:
 * "Retention period: 5 years → 10 years | Status: Draft → Approved"
 *
 * A create or an export has no "before" at all, so those list their values plainly
 * ("What was exported: Breach register | How: Spreadsheet (CSV)") instead of pairing every
 * value with an empty one.
 */
function changeSummary(entry, lang, t) {
  const rows = auditChangeRows(entry, lang, t);
  if (rows.length === 0) return TEXT[lang === 'pl' ? 'pl' : 'en'].noChanges;
  const hasBefore = Boolean(entry.oldValue);
  return rows
    .map((r) => (hasBefore
      ? `${r.label}: ${r.before ?? '—'} → ${r.after ?? '—'}`
      : `${r.label}: ${r.after ?? '—'}`))
    .join(MULTI);
}

/**
 * @param {object}   p
 * @param {object[]} p.entries        the audit entries to include (already filtered on screen)
 * @param {object}   [p.receipt]      the EXPORT audit entry recorded for THIS download, so the
 *                                    file names the entry that proves who exported it
 * @param {string}   [p.filterSummary] the filters that were on screen
 * @param {string}   [p.exportedAt]   ISO timestamp to stamp when there is no receipt
 * @param {'pl'|'en'} p.lang          language for every heading, label and date
 * @param {(key: string) => string} p.t the app's translator, so the wording matches the
 *                                      audit screen exactly
 * @returns {string} the CSV text (no BOM — the download helper adds it)
 */
export function buildAuditCsv({ entries = [], receipt, filterSummary, exportedAt, lang, t }) {
  const w = TEXT[lang === 'pl' ? 'pl' : 'en'];
  const d = delimiterFor(lang);
  const row = (values) => rowOf(values, d);
  const stamp = receipt?.at ?? exportedAt;

  const lines = [
    // Provenance: what this file is, who took it, and the audit entry proving it.
    row([w.title]),
    row([w.exportedAt, dateTime(stamp, lang)]),
    row([w.exportedBy, receipt?.actorName
      ? `${receipt.actorName} (${roleLabel(receipt.actorRole, lang)})`
      : '']),
    row([w.receipt, receipt?.id ?? '']),
    row([w.filters, filterSummary || w.none]),
    row([w.rowCount, entries.length]),
    '',
    row([w.legend]),
    '',
    row(w.headers),
  ];

  entries.forEach((e, i) => {
    lines.push(row([
      i + 1,
      dateTime(e.at, lang),
      e.actorName,
      roleLabel(e.actorRole, lang),
      auditActionLabel(e.action, t),
      auditEntityLabel(e.entityType, t),
      e.entityLabel ?? '—',
      changeSummary(e, lang, t),
      e.ipAddress ?? '',
      deviceSummary(e.userAgent),
      e.id,
      e.userAgent ?? '',
    ]));
  });

  return joinCsv(lines);
}
