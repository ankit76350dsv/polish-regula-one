// Builds the audit-trail CSV export (GDPR Art. 5(2) accountability evidence).
//
// WHY CSV (and not JSON): this file is evidence handed to an auditor, a lawyer or a UODO
// inspector, and they open it in Excel or LibreOffice — not in a code editor. Nothing is
// lost by using CSV: the before/after values are the only nested part of an entry, and they
// are written into their own cells as compact JSON text, so the full detail is still there.
//
// Two details that matter for a real spreadsheet:
//   - times stay in ISO 8601 UTC, so a timestamp can never be misread as a local time;
//   - the caller prepends a BOM when downloading, so Excel shows Polish characters
//     (ą, ę, ł, ż) correctly instead of mojibake.
//
// Lives in lib/ (like breachReport.js and noticeBuilder.js) so the document format is
// testable on its own, away from the page that triggers the download.

// Wrap every cell in quotes and double any quote inside it — the standard CSV escape.
const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;

// Nested before/after values become compact JSON inside one cell — readable, and lossless.
const cell = (v) => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : v);

/** The column headers, in order. Exported so a test can assert the shape. */
export const AUDIT_CSV_HEADERS = [
  'Entry ID', 'Timestamp (UTC)', 'Actor', 'Acting as (role)', 'Action',
  'Entity type', 'Entity ID', 'Entity label', 'Old value', 'New value',
  'IP address', 'User agent',
];

/**
 * @param {object}   p
 * @param {object[]} p.entries        the audit entries to include (already filtered on screen)
 * @param {object}   [p.receipt]      the EXPORT audit entry recorded for THIS download, so the
 *                                    file names the entry that proves who exported it
 * @param {string}   [p.filterSummary] the filters that were on screen
 * @param {string}   [p.exportedAt]   ISO timestamp to stamp when there is no receipt
 * @returns {string} the CSV text (no BOM — the download helper adds it)
 */
export function buildAuditCsv({ entries = [], receipt, filterSummary, exportedAt }) {
  const lines = [];

  // Provenance block: what this file is, who took it, and the audit entry proving it.
  lines.push(`${esc('Rejestr audytowy / Audit trail')},${esc('GDPR Art. 5(2)')}`);
  lines.push(`${esc('Exported at / Wyeksportowano')},${esc(receipt?.at ?? exportedAt)}`);
  lines.push(`${esc('Exported by / Eksportujący')},${esc(
    receipt?.actorName ? `${receipt.actorName} (${receipt.actorRole ?? ''})` : '',
  )}`);
  lines.push(`${esc('Audit receipt / Wpis audytowy')},${esc(receipt?.id)}`);
  lines.push(`${esc('Filters / Filtry')},${esc(filterSummary)}`);
  lines.push(`${esc('Records / Liczba wpisów')},${esc(entries.length)}`);
  lines.push('');

  lines.push(AUDIT_CSV_HEADERS.map(esc).join(','));

  for (const e of entries) {
    lines.push([
      e.id, e.at, e.actorName, e.actorRole, e.action,
      e.entityType, e.entityId, e.entityLabel,
      cell(e.oldValue), cell(e.newValue),
      e.ipAddress, e.userAgent,
    ].map(esc).join(','));
  }
  return lines.join('\r\n');
}
