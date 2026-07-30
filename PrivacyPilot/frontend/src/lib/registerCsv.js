// Builds the Art. 30 register export (ROPA) as a spreadsheet a person can actually read.
//
// WHO OPENS THIS FILE: a DPO, a company's lawyer, an auditor, or an inspector from UODO.
// They open it in Excel or LibreOffice. They do not read raw codes, they do not know what a
// database id is, and if the columns do not line up they will assume the product is broken.
// So the export follows their expectations, not the database's:
//
//   • every value is a LABEL, in the chosen language — "Zatwierdzony", not "approved";
//     "DPIA wymagana", not "required"; "Tak"/"Nie", not "yes"/"no"
//   • every heading names the GDPR article it evidences, so the file defends itself in an
//     audit without anyone having to explain it
//   • rows are numbered 1, 2, 3… the way a register is numbered, instead of leading with a
//     24-character database id
//   • dates are written the way the reader's country writes them, not as ISO timestamps
//   • the delimiter matches what that language's Excel expects (semicolon for Polish,
//     comma for English) — get this wrong and the whole file lands in ONE column, which is
//     the single most common "the export is broken" complaint about CSV files
//   • the file opens with a provenance block: who the controller is, which register this is,
//     when it was taken and how many rows it holds
//
// Lives in lib/ next to auditCsv.js / breachReport.js / noticeBuilder.js so the document
// format can be tested on its own.
import {
  ART6_BASES, ART9_CONDITIONS, DATA_CATEGORIES, DATA_SUBJECT_CATEGORIES, DEPARTMENTS,
  RECIPIENT_CATEGORIES, TOMS, labelOf,
} from './gdpr';
import { activityCompleteness } from './completeness';

// Several values per cell (data categories, recipients, security measures). A pipe is used
// rather than a comma or semicolon because the LABELS THEMSELVES contain commas
// ("Dane identyfikacyjne (imię, nazwisko, PESEL)") and the delimiter may be a semicolon —
// so anything else would be ambiguous to read.
const MULTI = ' | ';

/**
 * Which character separates the columns.
 *
 * Polish Excel treats the semicolon as the list separator and will NOT split a
 * comma-separated file into columns; English/US Excel expects the comma. Matching the
 * language is what makes the file open correctly by double-click, with no import wizard.
 */
function delimiterFor(lang) {
  return lang === 'pl' ? ';' : ',';
}

// Quote every cell and double any quote inside it — the standard CSV escape. Quoting
// unconditionally means a value containing the delimiter or a line break is always safe.
function cell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

// "30.07.2026" in Polish, "30/07/2026" in English. Blank stays blank rather than becoming
// "Invalid Date".
function shortDate(iso, lang) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-GB');
}

/**
 * The moment the file was taken, WITH its time zone.
 *
 * The zone matters: this is evidence, and "13:35" on its own is unanswerable if the reader
 * and the exporter are in different countries — which for a Polish company using an
 * EU-hosted service is normal.
 */
function dateTime(iso, lang) {
  if (!iso) return '';
  // The parts are listed individually because `timeZoneName` cannot be combined with the
  // `dateStyle`/`timeStyle` shorthands — doing so throws.
  return new Date(iso).toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });
}

// Turn a list of codes into readable labels joined for one cell.
function labels(codes, list, lang) {
  return (codes ?? []).map((code) => labelOf(list, code, lang)).join(MULTI);
}

// "Legal obligation (Art. 6(1)(c))" — the meaning, plus the citation an auditor looks for.
function withRef(list, code, lang) {
  const entry = list.find((x) => x.id === code);
  const label = entry?.[lang] ?? code;
  return entry?.ref ? `${label} (${entry.ref})` : label;
}

// ── Wording ──────────────────────────────────────────────────────────────────────────
// Kept here rather than in the i18n dictionary because these strings exist ONLY inside the
// exported document; putting them in the app dictionary would imply they appear on screen.
const TEXT = {
  pl: {
    controllerRegister: 'Rejestr czynności przetwarzania — art. 30 ust. 1 RODO',
    processorRegister: 'Rejestr kategorii czynności przetwarzania — art. 30 ust. 2 RODO',
    controller: 'Administrator danych',
    processor: 'Podmiot przetwarzający',
    address: 'Adres',
    dpo: 'Inspektor Ochrony Danych (IOD)',
    register: 'Rejestr',
    exportedAt: 'Data eksportu',
    rowCount: 'Liczba czynności',
    notSet: 'nie uzupełniono',
    controllerHeaders: [
      'Lp.',
      'Nazwa czynności',
      'Dział',
      'Status',
      'Cel przetwarzania (art. 30 ust. 1 lit. b)',
      'Podstawa prawna (art. 6 ust. 1)',
      'Uzasadniony interes — opis (art. 6 ust. 1 lit. f)',
      'Warunek dla danych szczególnych (art. 9 ust. 2)',
      'Dane o wyrokach skazujących (art. 10)',
      'Kategorie osób, których dane dotyczą (art. 30 ust. 1 lit. c)',
      'Kategorie danych osobowych (art. 30 ust. 1 lit. c)',
      'Kategorie odbiorców (art. 30 ust. 1 lit. d)',
      'Przekazanie do kraju trzeciego (art. 30 ust. 1 lit. e)',
      'Okres przechowywania (art. 30 ust. 1 lit. f)',
      'Podstawa okresu przechowywania',
      'Środki techniczne i organizacyjne (art. 32)',
      'Wynik oceny DPIA (art. 35)',
      'Kompletność wpisu',
      'Ostatnia aktualizacja',
      'Identyfikator systemowy',
    ],
    processorHeaders: [
      'Lp.',
      'Nazwa czynności',
      'Dział',
      'Status',
      'Administratorzy, na rzecz których działamy (art. 30 ust. 2 lit. a)',
      'Kategorie przetwarzania (art. 30 ust. 2 lit. b)',
      'Kategorie osób, których dane dotyczą',
      'Kategorie danych osobowych',
      'Przekazanie do kraju trzeciego (art. 30 ust. 2 lit. c)',
      'Środki techniczne i organizacyjne (art. 32 / art. 30 ust. 2 lit. d)',
      'Kompletność wpisu',
      'Ostatnia aktualizacja',
      'Identyfikator systemowy',
    ],
  },
  en: {
    controllerRegister: 'Record of processing activities — Art. 30(1) GDPR',
    processorRegister: 'Record of categories of processing — Art. 30(2) GDPR',
    controller: 'Controller',
    processor: 'Processor',
    address: 'Address',
    dpo: 'Data Protection Officer (DPO)',
    register: 'Register',
    exportedAt: 'Exported',
    rowCount: 'Activities',
    notSet: 'not provided',
    controllerHeaders: [
      'No.',
      'Activity name',
      'Department',
      'Status',
      'Purpose of processing (Art. 30(1)(b))',
      'Lawful basis (Art. 6(1))',
      'Legitimate interest — description (Art. 6(1)(f))',
      'Condition for special categories (Art. 9(2))',
      'Criminal conviction data (Art. 10)',
      'Categories of data subjects (Art. 30(1)(c))',
      'Categories of personal data (Art. 30(1)(c))',
      'Categories of recipients (Art. 30(1)(d))',
      'Transfer to a third country (Art. 30(1)(e))',
      'Retention period (Art. 30(1)(f))',
      'Basis for the retention period',
      'Technical and organisational measures (Art. 32)',
      'DPIA outcome (Art. 35)',
      'Record completeness',
      'Last updated',
      'System identifier',
    ],
    processorHeaders: [
      'No.',
      'Activity name',
      'Department',
      'Status',
      'Controllers on whose behalf we act (Art. 30(2)(a))',
      'Categories of processing (Art. 30(2)(b))',
      'Categories of data subjects',
      'Categories of personal data',
      'Transfer to a third country (Art. 30(2)(c))',
      'Technical and organisational measures (Art. 32 / Art. 30(2)(d))',
      'Record completeness',
      'Last updated',
      'System identifier',
    ],
  },
};

/**
 * Build the register CSV.
 *
 * @param {object}   p
 * @param {object}   p.settings   company + DPO details (the register's own identity block)
 * @param {object[]} p.activities the rows to include — already filtered as shown on screen
 * @param {'pl'|'en'} p.lang      language for every label, heading and date
 * @param {'controller'|'processor'} p.tab which register this is
 * @param {(key: string) => string} p.t    the app's translator, for the values that come
 *                                         from the shared dictionary (status, DPIA verdict,
 *                                         yes/no) so the export can never disagree with the
 *                                         screen
 * @param {string}   [p.exportedAt] ISO timestamp to stamp the file with
 * @returns {string} CSV text (no BOM — the download helper adds it)
 */
export function buildRegisterCsv({ settings, activities = [], lang, tab, t, exportedAt }) {
  const isProcessor = tab === 'processor';
  const w = TEXT[lang === 'pl' ? 'pl' : 'en'];
  const d = delimiterFor(lang);
  const row = (values) => values.map(cell).join(d);
  const yesNo = (value) => (value ? t('common.yes') : t('common.no'));
  // Blank cells read as an oversight in a compliance document, so say so explicitly.
  const orNotSet = (value) => (value == null || value === '' ? w.notSet : value);

  const company = settings?.company ?? {};
  const dpo = settings?.dpo ?? {};
  const lines = [];

  // ── Provenance block: whose register, which register, taken when, how big ──────────
  lines.push(row([isProcessor ? w.processor : w.controller, orNotSet(company.name)]));
  lines.push(row([w.address, orNotSet(company.address)]));
  lines.push(row(['NIP', orNotSet(company.nip), 'REGON', orNotSet(company.regon)]));
  lines.push(row([w.dpo, orNotSet([dpo.name, dpo.email, dpo.phone].filter(Boolean).join(', '))]));
  lines.push(row([w.register, isProcessor ? w.processorRegister : w.controllerRegister]));
  lines.push(row([w.exportedAt, dateTime(exportedAt ?? new Date().toISOString(), lang)]));
  lines.push(row([w.rowCount, activities.length]));
  lines.push('');

  if (isProcessor) {
    lines.push(row(w.processorHeaders));
    activities.forEach((a, i) => {
      lines.push(row([
        i + 1,
        a.name,
        labelOf(DEPARTMENTS, a.department, lang),
        t(`status.${a.status}`),
        orNotSet(a.controllersServed),
        orNotSet(a.purpose),
        labels(a.dataSubjects, DATA_SUBJECT_CATEGORIES, lang),
        labels(a.dataCategories, DATA_CATEGORIES, lang),
        yesNo(a.transfer),
        labels(a.toms, TOMS, lang),
        `${activityCompleteness(a)}%`,
        shortDate(a.updatedAt, lang),
        a.id,
      ]));
    });
    return lines.join('\r\n');
  }

  lines.push(row(w.controllerHeaders));
  activities.forEach((a, i) => {
    // Both of these are written out in words AND carry the article reference, so each cell
    // is self-explanatory: a bare "h" or "legitimate_interest" means nothing to a reader.
    // The reference comes from the shared list's own `ref`, so the citation is written one
    // way everywhere in the product.
    const art9 = a.art9Condition ? withRef(ART9_CONDITIONS, a.art9Condition, lang) : '';
    const basis = a.lawfulBasis ? withRef(ART6_BASES, a.lawfulBasis, lang) : '';

    lines.push(row([
      i + 1,
      a.name,
      labelOf(DEPARTMENTS, a.department, lang),
      t(`status.${a.status}`),
      orNotSet(a.purpose),
      orNotSet(basis),
      // Only meaningful when the basis IS legitimate interest; blank otherwise, not "not set".
      a.lawfulBasis === 'legitimate_interest' ? orNotSet(a.legitimateInterestDetail) : '',
      art9,
      yesNo(a.art10),
      labels(a.dataSubjects, DATA_SUBJECT_CATEGORIES, lang),
      labels(a.dataCategories, DATA_CATEGORIES, lang),
      labels(a.recipients, RECIPIENT_CATEGORIES, lang),
      yesNo(a.transfer),
      orNotSet(a.retentionPeriod),
      orNotSet(a.retentionBasis),
      labels(a.toms, TOMS, lang),
      a.dpiaVerdict ? t(`dpia.verdict.${a.dpiaVerdict}`) : '',
      `${activityCompleteness(a)}%`,
      shortDate(a.updatedAt, lang),
      a.id,
    ]));
  });
  return lines.join('\r\n');
}

/** A readable file name in the reader's language, e.g. "Rejestr-ROPA-administrator-2026-07-30.csv". */
export function registerCsvFilename(tab, lang, now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  const role = lang === 'pl'
    ? (tab === 'processor' ? 'podmiot-przetwarzajacy' : 'administrator')
    : (tab === 'processor' ? 'processor' : 'controller');
  const base = lang === 'pl' ? 'Rejestr-ROPA' : 'ROPA-register';
  return `${base}-${role}-${date}.csv`;
}
