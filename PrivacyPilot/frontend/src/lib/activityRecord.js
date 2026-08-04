// Builds the RECORD SHEET for one processing activity — its full Art. 30 entry as a
// standalone document.
//
// WHY, GIVEN THE REGISTER ALREADY EXPORTS TO CSV: the CSV is the whole register, and it is
// the right thing to hand an inspector who asks for the register. But a great deal of the
// real work happens one activity at a time — the department that owns it wants to review
// its own entry, the DPO attaches a single record to an approval e-mail, a lawyer reads one
// activity before advising on it. Sending someone a twenty-column spreadsheet so they can
// read one row of it does not serve that, and asking them to find the row invites reading
// the wrong one.
//
// Same Art. 30 fields as the register, same labels, same article references — just laid out
// as a document instead of a row, and covering BOTH shapes of entry: Art. 30(1) when we are
// the controller, Art. 30(2) when we act as a processor for someone else.
import {
  ART6_BASES, ART9_CONDITIONS, DATA_CATEGORIES, DATA_SUBJECT_CATEGORIES, DEPARTMENTS,
  RECIPIENT_CATEGORIES, TOMS, TRANSFER_MECHANISMS, byId, labelOf,
} from './gdpr';
import { DPIA_CRITERIA } from './dpiaCriteria';
import { activityCompleteness } from './completeness';

const orDash = (v) => (v == null || v === '' ? '—' : v);
const fmtDate = (iso, pl) => (iso ? new Date(iso).toLocaleDateString(pl ? 'pl-PL' : 'en-GB') : '—');

/**
 * @param {object}   p
 * @param {object}   p.activity   the activity
 * @param {object}   [p.settings]  company + DPO details
 * @param {object[]} [p.vendors]   to name the linked processors instead of their ids
 * @param {object[]} [p.transfers] to describe the linked transfers
 * @param {'pl'|'en'} p.lang
 * @param {(key: string) => string} p.t the app's translator, so status and DPIA wording
 *                                      matches the screen exactly
 * @returns {string} a Markdown document ready to download, open in Word, or print.
 */
export function buildActivityRecord({
  activity, settings, vendors = [], transfers = [], lang, t,
}) {
  const pl = lang === 'pl';
  const company = settings?.company ?? {};
  const dpo = settings?.dpo ?? {};
  const preparedAt = new Date().toLocaleString(pl ? 'pl-PL' : 'en-GB');
  const missing = pl ? '[uzupełnij w Ustawieniach]' : '[set in Settings]';
  const isProcessor = activity.role === 'processor';
  const yesNo = (v) => (v ? (pl ? 'Tak' : 'Yes') : (pl ? 'Nie' : 'No'));
  const list = (codes, ref) => {
    const values = (codes ?? []).map((c) => labelOf(ref, c, lang));
    return values.length > 0 ? values.map((v) => `- ${v}`).join('\n') : `- ${pl ? 'brak' : 'none'}`;
  };

  const T = pl
    ? {
        head: 'KARTA CZYNNOŚCI PRZETWARZANIA',
        subControl: 'Rejestr czynności przetwarzania — art. 30 ust. 1 RODO',
        subProcess: 'Rejestr kategorii czynności przetwarzania — art. 30 ust. 2 RODO',
        prepared: 'Przygotowano',
        controller: '1. ADMINISTRATOR',
        name: 'Nazwa', address: 'Adres',
        dpo: 'Inspektor Ochrony Danych (IOD)',
        identity: '2. IDENTYFIKACJA CZYNNOŚCI',
        actName: 'Nazwa czynności', department: 'Dział', owner: 'Osoba odpowiedzialna',
        role: 'Rola', roleController: 'Administrator', roleProcessor: 'Podmiot przetwarzający',
        status: 'Status', completeness: 'Kompletność wpisu', updated: 'Ostatnia aktualizacja',
        purpose: '3. CEL PRZETWARZANIA — art. 30 ust. 1 lit. b',
        controllers: 'Administratorzy, na rzecz których działamy (art. 30 ust. 2 lit. a)',
        basis: '4. PODSTAWA PRAWNA — art. 6 ust. 1',
        legitimate: 'Uzasadniony interes — opis (art. 6 ust. 1 lit. f)',
        art9: 'Warunek dla danych szczególnych (art. 9 ust. 2)',
        art10: 'Dane o wyrokach skazujących (art. 10)',
        basisProcessor: 'Nie dotyczy — czynność wykonywana na polecenie administratora '
          + '(art. 28 ust. 3 lit. a).',
        data: '5. KATEGORIE DANYCH I OSÓB — art. 30 ust. 1 lit. c',
        subjects: 'Kategorie osób, których dane dotyczą',
        categories: 'Kategorie danych osobowych',
        sources: 'Źródła danych',
        recipients: '6. ODBIORCY I PODMIOTY PRZETWARZAJĄCE — art. 30 ust. 1 lit. d',
        recipientCats: 'Kategorie odbiorców',
        processors: 'Podmioty przetwarzające (art. 28)',
        transfers: '7. PRZEKAZANIE DO KRAJÓW TRZECICH — art. 30 ust. 1 lit. e',
        noTransfer: 'Dane nie są przekazywane poza EOG.',
        transferNoneLinked: 'Zadeklarowano przekazanie, ale NIE POWIĄZANO żadnego wpisu '
          + 'w rejestrze przekazań — wpis wymaga uzupełnienia.',
        tiaMissing: 'brak udokumentowanej oceny skutków przekazania (TIA)',
        retention: '8. OKRES PRZECHOWYWANIA — art. 30 ust. 1 lit. f',
        period: 'Okres przechowywania', retBasis: 'Podstawa okresu przechowywania',
        toms: '9. ŚRODKI TECHNICZNE I ORGANIZACYJNE — art. 32 / art. 30 ust. 1 lit. g',
        dpia: '10. OCENA POTRZEBY DPIA — art. 35 / M.P. 2019 poz. 666',
        criteria: 'Spełnione kryteria', verdict: 'Wynik oceny',
        linkedDpia: 'Powiązana ocena DPIA (identyfikator)',
        noCriteria: '- brak',
        id: 'Identyfikator systemowy',
      }
    : {
        head: 'PROCESSING ACTIVITY RECORD SHEET',
        subControl: 'Record of processing activities — Art. 30(1) GDPR',
        subProcess: 'Record of categories of processing — Art. 30(2) GDPR',
        prepared: 'Prepared',
        controller: '1. CONTROLLER',
        name: 'Name', address: 'Address',
        dpo: 'Data Protection Officer (DPO)',
        identity: '2. IDENTIFICATION OF THE ACTIVITY',
        actName: 'Activity name', department: 'Department', owner: 'Owner',
        role: 'Role', roleController: 'Controller', roleProcessor: 'Processor',
        status: 'Status', completeness: 'Record completeness', updated: 'Last updated',
        purpose: '3. PURPOSE OF THE PROCESSING — Art. 30(1)(b)',
        controllers: 'Controllers on whose behalf we act (Art. 30(2)(a))',
        basis: '4. LAWFUL BASIS — Art. 6(1)',
        legitimate: 'Legitimate interest — description (Art. 6(1)(f))',
        art9: 'Condition for special categories (Art. 9(2))',
        art10: 'Criminal conviction data (Art. 10)',
        basisProcessor: 'Not applicable — carried out on the controller’s instructions '
          + '(Art. 28(3)(a)).',
        data: '5. CATEGORIES OF DATA AND DATA SUBJECTS — Art. 30(1)(c)',
        subjects: 'Categories of data subjects',
        categories: 'Categories of personal data',
        sources: 'Sources of the data',
        recipients: '6. RECIPIENTS AND PROCESSORS — Art. 30(1)(d)',
        recipientCats: 'Categories of recipients',
        processors: 'Processors (Art. 28)',
        transfers: '7. TRANSFERS TO THIRD COUNTRIES — Art. 30(1)(e)',
        noTransfer: 'No data is transferred outside the EEA.',
        transferNoneLinked: 'A transfer is declared but NO entry in the transfer register is '
          + 'linked — this record is incomplete.',
        tiaMissing: 'no documented transfer impact assessment (TIA)',
        retention: '8. RETENTION PERIOD — Art. 30(1)(f)',
        period: 'Retention period', retBasis: 'Basis for the retention period',
        toms: '9. TECHNICAL AND ORGANISATIONAL MEASURES — Art. 32 / Art. 30(1)(g)',
        dpia: '10. DPIA SCREENING — Art. 35 / M.P. 2019 item 666',
        criteria: 'Criteria met', verdict: 'Screening outcome',
        linkedDpia: 'Linked DPIA (identifier)',
        noCriteria: '- none',
        id: 'System identifier',
      };

  const lines = [
    `# ${T.head}`,
    `_${isProcessor ? T.subProcess : T.subControl}_`,
    `${T.prepared}: ${preparedAt}`,
    '',
    `## ${T.controller}`,
    `${T.name}: ${company.name || missing}`,
    `${T.address}: ${company.address || missing}`,
    `NIP: ${orDash(company.nip)}   REGON: ${orDash(company.regon)}`,
    `${T.dpo}: ${[dpo.name, dpo.email, dpo.phone].filter(Boolean).join(', ') || missing}`,
    '',
    `## ${T.identity}`,
    `${T.actName}: ${orDash(activity.name)}`,
    `${T.department}: ${labelOf(DEPARTMENTS, activity.department, lang)}`,
    `${T.owner}: ${orDash(activity.ownerName)}`,
    `${T.role}: ${isProcessor ? T.roleProcessor : T.roleController}`,
    `${T.status}: ${t(`status.${activity.status}`)}`,
    `${T.completeness}: ${activityCompleteness(activity)}%`,
    `${T.updated}: ${fmtDate(activity.updatedAt, pl)}`,
    '',
    `## ${T.purpose}`,
    orDash(activity.purpose),
  ];

  // Acting as a processor, the register asks a different question: not "on what basis do you
  // do this?" but "for whom do you do it?" (Art. 30(2)(a)).
  if (isProcessor) {
    lines.push('', `${T.controllers}: ${orDash(activity.controllersServed)}`);
    lines.push('', `## ${T.basis}`, T.basisProcessor);
  } else {
    const basis = activity.lawfulBasis
      ? `${labelOf(ART6_BASES, activity.lawfulBasis, lang)} (${orDash(byId(ART6_BASES, activity.lawfulBasis)?.ref)})`
      : '—';
    lines.push('', `## ${T.basis}`, basis);
    // Only meaningful when the basis actually IS legitimate interest.
    if (activity.lawfulBasis === 'legitimate_interest') {
      lines.push('', `${T.legitimate}: ${orDash(activity.legitimateInterestDetail)}`);
    }
    if (activity.art9Condition) {
      lines.push(`${T.art9}: ${labelOf(ART9_CONDITIONS, activity.art9Condition, lang)} `
        + `(${orDash(byId(ART9_CONDITIONS, activity.art9Condition)?.ref)})`);
    }
    lines.push(`${T.art10}: ${yesNo(activity.art10)}`);
  }

  lines.push(
    '',
    `## ${T.data}`,
    `**${T.subjects}:**`,
    list(activity.dataSubjects, DATA_SUBJECT_CATEGORIES),
    '',
    `**${T.categories}:**`,
    list(activity.dataCategories, DATA_CATEGORIES),
    '',
    `**${T.sources}:** ${(activity.dataSources ?? []).join('; ') || '—'}`,
    '',
    `## ${T.recipients}`,
    `**${T.recipientCats}:**`,
    list(activity.recipients, RECIPIENT_CATEGORIES),
    '',
    `**${T.processors}:**`,
    (activity.vendorIds ?? []).length > 0
      ? (activity.vendorIds ?? [])
          .map((vid) => `- ${vendors.find((v) => v.id === vid)?.name ?? vid}`).join('\n')
      : `- ${pl ? 'brak' : 'none'}`,
    '',
    `## ${T.transfers}`,
  );

  if (!activity.transfer) {
    lines.push(T.noTransfer);
  } else if ((activity.transferIds ?? []).length === 0) {
    // The same finding the detail screen shows in amber: a declared transfer with nothing
    // linked is an incomplete Art. 30(1)(e) entry, and the document must not hide that.
    lines.push(T.transferNoneLinked);
  } else {
    lines.push(...(activity.transferIds ?? []).map((tid) => {
      const tr = transfers.find((x) => x.id === tid);
      if (!tr) return `- ${tid}`;
      const gap = !tr.tiaDocumented && tr.mechanism !== 'adequacy' ? ` — ${T.tiaMissing}` : '';
      return `- ${tr.destinationCountry}: ${tr.recipient} — `
        + `${labelOf(TRANSFER_MECHANISMS, tr.mechanism, lang)}${gap}`;
    }));
  }

  lines.push(
    '',
    `## ${T.retention}`,
    `${T.period}: ${orDash(activity.retentionPeriod)}`,
    `${T.retBasis}: ${orDash(activity.retentionBasis)}`,
    '',
    `## ${T.toms}`,
    list(activity.toms, TOMS),
    '',
    `## ${T.dpia}`,
    `**${T.criteria}:**`,
    (activity.dpiaCriteria ?? []).length > 0
      ? (activity.dpiaCriteria ?? []).map((c) => `- ${labelOf(DPIA_CRITERIA, c, lang)}`).join('\n')
      : T.noCriteria,
    '',
    `${T.verdict}: ${activity.dpiaVerdict ? t(`dpia.verdict.${activity.dpiaVerdict}`) : '—'}`,
    `${T.linkedDpia}: ${orDash(activity.dpiaId)}`,
    '',
    `---`,
    `${T.id}: ${activity.id}`,
    '',
  );

  return lines.join('\n');
}
