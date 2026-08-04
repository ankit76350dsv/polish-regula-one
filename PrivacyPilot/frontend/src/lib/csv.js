// Shared spreadsheet plumbing for every register export in PrivacyPilot.
//
// WHY THIS EXISTS: the app exports seven different registers (ROPA, impact assessments,
// processors, transfers, breaches, data subject requests, user access) plus the audit trail.
// Each one is opened by the same kind of reader — a DPO, a company lawyer, an auditor, or an
// inspector from UODO — in Excel or LibreOffice. Every one of them needs the same four
// things done right, and every one of them had started to grow its own copy:
//
//   • the DELIMITER must match the reader's Excel. Polish Excel treats the semicolon as the
//     list separator and will NOT split a comma-separated file into columns; English/US
//     Excel expects the comma. Getting this wrong lands the whole file in ONE column, which
//     is the single most common "the export is broken" complaint about CSV files.
//   • every cell must be QUOTED and its own quotes doubled, or a value containing the
//     delimiter (or a line break) silently destroys the row.
//   • the file must open with a PROVENANCE block — whose register this is, which register,
//     taken when, how big, and under which filters. Without it the file is an anonymous
//     grid of text that proves nothing.
//   • the download must carry a BOM, or Excel shows Polish characters (ą, ę, ł, ż) as
//     mojibake.
//
// Before this module, the BOM download helper existed twice (RegisterPage and
// AuditTrailPage each had a private copy) and the provenance wording lived only inside
// registerCsv.js. One copy, used by all of them.

// Several values in one cell (data categories, recipients, measures). A pipe is used rather
// than a comma or semicolon because the LABELS THEMSELVES contain commas ("Dane
// identyfikacyjne (imię, nazwisko, PESEL)") and the delimiter may be a semicolon — so
// anything else would be ambiguous to read.
export const MULTI = ' | ';

/**
 * Which character separates the columns — semicolon for Polish, comma for English.
 * Matching the language is what makes the file open correctly by double-click, with no
 * import wizard.
 */
export function delimiterFor(lang) {
  return lang === 'pl' ? ';' : ',';
}

/**
 * Quote a cell and double any quote inside it — the standard CSV escape. Quoting
 * unconditionally means a value containing the delimiter or a line break is always safe.
 */
export function cell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

/** Build one CSV line from an array of values. */
export function rowOf(values, delimiter) {
  return values.map(cell).join(delimiter);
}

/** "30.07.2026" in Polish, "30/07/2026" in English. Blank stays blank, never "Invalid Date". */
export function shortDate(iso, lang) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-GB');
}

/**
 * A moment WITH its time zone.
 *
 * The zone matters: this is evidence, and "13:35" on its own is unanswerable if the reader
 * and the exporter are in different countries — which for a Polish company using an
 * EU-hosted service is normal.
 */
export function dateTime(iso, lang) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  // The parts are listed individually because `timeZoneName` cannot be combined with the
  // `dateStyle`/`timeStyle` shorthands — doing so throws.
  return date.toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });
}

// ── Provenance wording ───────────────────────────────────────────────────────────────
// Kept here rather than in the i18n dictionary because these strings exist ONLY inside an
// exported file; putting them in the app dictionary would imply they appear on screen.
const TEXT = {
  pl: {
    controller: 'Administrator danych',
    address: 'Adres',
    dpo: 'Inspektor Ochrony Danych (IOD)',
    register: 'Rejestr',
    exportedAt: 'Data eksportu',
    rowCount: 'Liczba pozycji',
    filters: 'Zastosowane filtry',
    notSet: 'nie uzupełniono',
    none: 'brak',
  },
  en: {
    controller: 'Controller',
    address: 'Address',
    dpo: 'Data Protection Officer (DPO)',
    register: 'Register',
    exportedAt: 'Exported',
    rowCount: 'Records',
    filters: 'Filters applied',
    notSet: 'not provided',
    none: 'none',
  },
};

/** The provenance wording for one language. */
export function csvText(lang) {
  return TEXT[lang === 'pl' ? 'pl' : 'en'];
}

/**
 * Blank cells read as an oversight in a compliance document, so say so explicitly:
 * an empty value becomes "not provided" / "nie uzupełniono" rather than nothing at all.
 */
export function orNotSet(value, lang) {
  return value == null || value === '' ? csvText(lang).notSet : value;
}

/**
 * The block every register export opens with: whose register, which register, taken when,
 * how big, and under which filters.
 *
 * @param {object}   p
 * @param {object}   [p.settings]       company + DPO details (the register's own identity)
 * @param {'pl'|'en'} p.lang
 * @param {string}   p.registerTitle    e.g. "Rejestr naruszeń — art. 33 ust. 5 RODO"
 * @param {number}   p.rowCount         how many rows follow
 * @param {string}   [p.entityLabel]    overrides "Controller" (the ROPA processor register
 *                                      is kept by us as a PROCESSOR, not a controller)
 * @param {string}   [p.filterSummary]  the filters that were on screen
 * @param {string}   [p.exportedAt]     ISO timestamp to stamp the file with
 * @returns {string[]} the block's lines, ending with one blank line
 */
export function provenanceLines({
  settings, lang, registerTitle, rowCount, entityLabel, filterSummary, exportedAt,
}) {
  const w = csvText(lang);
  const d = delimiterFor(lang);
  const row = (values) => rowOf(values, d);
  const company = settings?.company ?? {};
  const dpo = settings?.dpo ?? {};

  return [
    row([entityLabel ?? w.controller, orNotSet(company.name, lang)]),
    row([w.address, orNotSet(company.address, lang)]),
    row(['NIP', orNotSet(company.nip, lang), 'REGON', orNotSet(company.regon, lang)]),
    // The DPO's contact details are what a reader uses to ask a question about the file.
    row([w.dpo, orNotSet([dpo.name, dpo.email, dpo.phone].filter(Boolean).join(', '), lang)]),
    row([w.register, registerTitle]),
    row([w.exportedAt, dateTime(exportedAt ?? new Date().toISOString(), lang)]),
    row([w.rowCount, rowCount]),
    row([w.filters, filterSummary || w.none]),
    '',
  ];
}

/**
 * Hand a finished CSV to the user as a download.
 *
 * The leading BOM (﻿) is what makes Excel read the file as UTF-8; without it Polish
 * characters arrive as mojibake. Rows are joined with CRLF by the builders, which is what
 * the CSV convention (and Excel) expects.
 */
export function downloadCsv(filename, content) {
  const blob = new Blob([`﻿${content}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * A readable, date-stamped file name, e.g. "Rejestr-naruszen-2026-08-03.csv".
 * The date is ISO so the files sort chronologically in a folder.
 */
export function csvFilename(base, now = new Date()) {
  return `${base}-${now.toISOString().slice(0, 10)}.csv`;
}

/** Join the CSV lines the way Excel expects. */
export function joinCsv(lines) {
  return lines.join('\r\n');
}
