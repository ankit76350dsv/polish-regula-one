// Handing a generated document to the user: download it, or open it for printing.
//
// WHY THIS IS SHARED: the privacy-notice screen and the breach-report dialog both produce a
// document from register data, and both had their own private copy of these helpers. Two
// copies means two places to get HTML escaping right — and one of them had already been
// missed once. One copy, used by both.
//
// WHAT A COMPLIANCE USER ACTUALLY NEEDS: these documents get published on a website, handed
// to employees, or pasted into the supervisory authority's form. Markdown alone is a
// developer's format — Windows often has nothing registered to open a .md file at all — so
// Word and print/PDF are offered alongside it.

/** Make text safe to place inside HTML. Used for BOTH the title and the body. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/** Trigger a browser download of `content` under `filename`. */
export function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** The raw document text, for anyone who wants to work with it as plain text. */
export function downloadMarkdown(filename, content) {
  downloadFile(filename, content, 'text/markdown;charset=utf-8');
}

/**
 * A .doc that Word (and LibreOffice) opens: the text wrapped in minimal HTML and served as
 * msword. Kept in a serif face at document size so it prints like a document, not a webpage.
 */
export function downloadWord(filename, title, content) {
  const html = '<!doctype html><html><head><meta charset="utf-8">'
    + `<title>${escapeHtml(title)}</title></head><body>`
    + '<pre style="font-family: Georgia, serif; white-space: pre-wrap; font-size: 12pt;">'
    + `${escapeHtml(content)}</pre></body></html>`;
  downloadFile(filename, html, 'application/msword');
}

/**
 * Open the document in a new window and start the browser's print dialog — which is also
 * how the user saves it as a PDF.
 *
 * Both the title and the body are escaped: the title is typed by a user and stored, so
 * writing it in raw would let one colleague's text run code in another's browser.
 */
export function printDocument(title, content) {
  const win = window.open('', '_blank');
  if (!win) return; // pop-up blocked — nothing to print into
  win.document.write(
    `<!doctype html><title>${escapeHtml(title)}</title>`
    + '<pre style="font-family: Georgia, serif; white-space: pre-wrap; '
    + `max-width: 48rem; margin: 2rem auto;">${escapeHtml(content)}</pre>`,
  );
  win.document.close();
  win.print();
}

/**
 * A file name a person can read, without characters that upset file systems:
 * documentFilename('Privacy notice', 'Employees', 3, 'md') → "Privacy-notice-Employees-v3.md"
 *
 * Diacritics are folded (Sygnaliści → Sygnalisci) so the name survives being e-mailed,
 * zipped, or opened on a system with a different code page.
 */
export function documentFilename(kind, subject, version, extension) {
  const slug = (text) => String(text ?? '')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const parts = [slug(kind), slug(subject)].filter(Boolean);
  if (version != null) parts.push(`v${version}`);
  return `${parts.join('-')}.${extension}`;
}
