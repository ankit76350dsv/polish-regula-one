// Builds the spreadsheet export for each of PrivacyPilot's supporting registers:
//
//   • impact assessments   — Art. 35
//   • processors           — Art. 28 / Art. 30(1)(d)
//   • transfers            — Chapter V / Art. 30(1)(e)
//   • breaches             — Art. 33(5)   ← documenting EVERY breach is a legal duty
//   • data subject requests— Arts. 12, 15-22
//   • user access          — Art. 32
//
// The Art. 30 register itself lives in registerCsv.js; the audit trail in auditCsv.js.
// All of them share the plumbing in csv.js (delimiter, quoting, dates, provenance, BOM).
//
// WHO OPENS THESE FILES: a DPO, a company's lawyer, an auditor, or an inspector from UODO.
// So the same rules as the Art. 30 register apply throughout:
//
//   • every value is a LABEL in the chosen language — "Podpisana", not "signed"
//   • every heading names the GDPR article it evidences, so the file defends itself in an
//     audit without anyone having to explain it
//   • rows are numbered 1, 2, 3… the way a register is numbered, rather than leading with a
//     24-character database id (which is still included, last, for cross-referencing)
//   • dates are written the way the reader's country writes them
//   • a few columns are COMPUTED findings rather than stored fields — "notified within
//     72 h?", "answered within the deadline?" — because that is the question an inspector
//     actually asks, and making the reader work it out from two timestamps invites mistakes
//
// Lives in lib/ next to the other document builders so each format can be tested on its own,
// away from the page that triggers the download.
import {
  DATA_CATEGORIES, DSAR_TYPES, TRANSFER_MECHANISMS, byId, labelOf,
} from './gdpr';
import { DPIA_CRITERIA, riskScoreLabel } from './dpiaCriteria';
import { roleLabel } from './permissions';
import {
  MULTI, csvFilename, delimiterFor, joinCsv, orNotSet, provenanceLines,
  rowOf, shortDate, dateTime,
} from './csv';

// The 72-hour window for notifying UODO of a breach (Art. 33(1)), in milliseconds.
// Kept here so the "within 72 h?" column can be worked out from the stored timestamps.
const UODO_WINDOW_MS = 72 * 60 * 60 * 1000;

// ── Wording ──────────────────────────────────────────────────────────────────────────
// Only ever seen inside an exported file, so it is kept here rather than in the app's i18n
// dictionary (which would imply it appears on screen).
const TEXT = {
  pl: {
    dpiaRegister: 'Rejestr ocen skutków dla ochrony danych (DPIA) — art. 35 RODO',
    vendorRegister: 'Rejestr podmiotów przetwarzających — art. 28 RODO',
    transferRegister: 'Rejestr przekazań do krajów trzecich — rozdział V RODO',
    breachRegister: 'Rejestr naruszeń ochrony danych osobowych — art. 33 ust. 5 RODO',
    dsarRegister: 'Rejestr żądań osób, których dane dotyczą — art. 12 i art. 15-22 RODO',
    userRegister: 'Rejestr dostępu użytkowników — art. 32 RODO',
    yes: 'Tak',
    no: 'Nie',
    notRequired: 'nie wymagane',
    onTime: 'Tak — w terminie',
    late: 'NIE — po terminie',
    pending: 'jeszcze nie',
    // Wording for the small counts and markers that would otherwise read as bare numbers
    // or as a yes/no answering the wrong question.
    doneMark: 'wykonano',
    pendingMark: 'w toku',
    none: 'brak',
    noTasks: 'brak zadań',
    noMeasures: 'brak zapisanych środków',
    noRisks: 'nie zidentyfikowano ryzyk',
    of: 'z',
    dpiaHeaders: [
      'Lp.',
      'Tytuł oceny',
      'Powiązana czynność przetwarzania',
      'Status',
      'Kryteria kwalifikujące (art. 35 ust. 3 / M.P. 2019 poz. 666)',
      'Systematyczny opis (art. 35 ust. 7 lit. a)',
      'Niezbędność i proporcjonalność (art. 35 ust. 7 lit. b)',
      'Liczba zidentyfikowanych ryzyk (art. 35 ust. 7 lit. c)',
      'Najwyższe ryzyko pierwotne (prawdopodobieństwo × waga, skala 1-25)',
      'Najwyższe ryzyko szczątkowe (po zastosowaniu środków)',
      'Środki zaradcze (art. 35 ust. 7 lit. d)',
      'Opinia IOD (art. 35 ust. 2)',
      'Wymagane uprzednie konsultacje z UODO (art. 36)',
      'Podpisy zatwierdzające',
      'Zatwierdzono przez',
      'Ostatnia aktualizacja',
      'Numer referencyjny w systemie',
    ],
    vendorHeaders: [
      'Lp.',
      'Podmiot przetwarzający',
      'Kraj',
      'Lokalizacja przetwarzania / hosting',
      'Status umowy powierzenia (art. 28 ust. 3)',
      'Poziom ryzyka',
      'Dalsi przetwarzający (art. 28 ust. 2 i 4)',
      'Data ostatniego przeglądu',
      'Ostatnia aktualizacja',
      'Numer referencyjny w systemie',
    ],
    transferHeaders: [
      'Lp.',
      'Odbiorca',
      'Powiązany podmiot przetwarzający',
      'Kraj przeznaczenia',
      'Podstawa przekazania (rozdział V)',
      'Uwagi / adnotacja o adekwatności',
      'Ocena skutków przekazania (TIA) udokumentowana',
      'Sygnatura oceny TIA',
      'Ostatnia aktualizacja',
      'Numer referencyjny w systemie',
    ],
    breachHeaders: [
      'Lp.',
      'Nazwa naruszenia',
      'Stwierdzenie naruszenia (start biegu 72 h)',
      'Status',
      'Poziom ryzyka',
      'Kategorie danych objętych naruszeniem',
      'Przybliżona liczba osób',
      'Przybliżona liczba wpisów/rekordów',
      'Charakter naruszenia (art. 33 ust. 3 lit. a)',
      'Wymagane zgłoszenie do UODO',
      'Data zgłoszenia do UODO',
      'Zgłoszono w terminie 72 h (art. 33 ust. 1)',
      'Sygnatura sprawy UODO',
      'Wymagane zawiadomienie osób (art. 34)',
      'Data zawiadomienia osób',
      'Uzasadnienie oceny ryzyka (art. 33 ust. 5)',
      'Środki zaradcze (art. 33 ust. 3 lit. d)',
      'Ostatnia aktualizacja',
      'Numer referencyjny w systemie',
    ],
    dsarHeaders: [
      'Lp.',
      'Osoba składająca żądanie',
      'E-mail',
      'Relacja z organizacją',
      'Rodzaj żądania (art. 15-22)',
      'Data otrzymania',
      'Termin odpowiedzi (art. 12 ust. 3)',
      'Termin przedłużony o 2 miesiące',
      'Uzasadnienie przedłużenia',
      'Status',
      'Data realizacji',
      'Odpowiedziano w terminie (art. 12 ust. 3)',
      'Podstawa odmowy (art. 12 ust. 5-6)',
      'Data odmowy',
      'Tożsamość potwierdzona',
      'Sposób potwierdzenia tożsamości',
      'Zadania zbierania danych (wykonane / wszystkie)',
      'Uwagi',
      'Ostatnia aktualizacja',
      'Numer referencyjny w systemie',
    ],
    userHeaders: [
      'Lp.',
      'Imię i nazwisko',
      'E-mail służbowy',
      'Uprawnienia w PrivacyPilot',
      'Rola konta',
      'Konto aktywne',
      'Ma dostęp do PrivacyPilot',
      'Numer referencyjny w systemie',
    ],
  },
  en: {
    dpiaRegister: 'Register of data protection impact assessments (DPIA) — Art. 35 GDPR',
    vendorRegister: 'Register of processors — Art. 28 GDPR',
    transferRegister: 'Register of transfers to third countries — Chapter V GDPR',
    breachRegister: 'Register of personal data breaches — Art. 33(5) GDPR',
    dsarRegister: 'Register of data subject requests — Arts. 12 and 15-22 GDPR',
    userRegister: 'User access register — Art. 32 GDPR',
    yes: 'Yes',
    no: 'No',
    notRequired: 'not required',
    onTime: 'Yes — within the deadline',
    late: 'NO — after the deadline',
    pending: 'not yet',
    doneMark: 'done',
    pendingMark: 'in progress',
    none: 'none',
    noTasks: 'no tasks recorded',
    noMeasures: 'no measures recorded',
    noRisks: 'no risks identified',
    of: 'of',
    dpiaHeaders: [
      'No.',
      'Assessment title',
      'Linked processing activity',
      'Status',
      'Triggering criteria (Art. 35(3) / M.P. 2019 item 666)',
      'Systematic description (Art. 35(7)(a))',
      'Necessity and proportionality (Art. 35(7)(b))',
      'Number of identified risks (Art. 35(7)(c))',
      'Highest inherent risk (likelihood × severity, scale 1-25)',
      'Highest residual risk (after the measures)',
      'Mitigation measures (Art. 35(7)(d))',
      'DPO advice (Art. 35(2))',
      'Prior consultation with UODO required (Art. 36)',
      'Approval signatures',
      'Approved by',
      'Last updated',
      'System reference number',
    ],
    vendorHeaders: [
      'No.',
      'Processor',
      'Country',
      'Processing location / hosting',
      'Data processing agreement status (Art. 28(3))',
      'Risk level',
      'Sub-processors (Art. 28(2) and (4))',
      'Last reviewed',
      'Last updated',
      'System reference number',
    ],
    transferHeaders: [
      'No.',
      'Recipient',
      'Linked processor',
      'Destination country',
      'Transfer mechanism (Chapter V)',
      'Notes / adequacy remark',
      'Transfer impact assessment (TIA) documented',
      'TIA reference',
      'Last updated',
      'System reference number',
    ],
    breachHeaders: [
      'No.',
      'Breach name',
      'Became aware (start of the 72h clock)',
      'Status',
      'Risk level',
      'Categories of data affected',
      'Approx. number of data subjects',
      'Approx. number of records',
      'Nature of the breach (Art. 33(3)(a))',
      'UODO notification required',
      'UODO notified at',
      'Notified within 72h (Art. 33(1))',
      'UODO reference / case no.',
      'Communication to data subjects required (Art. 34)',
      'Data subjects notified at',
      'Risk decision rationale (Art. 33(5))',
      'Measures taken (Art. 33(3)(d))',
      'Last updated',
      'System reference number',
    ],
    dsarHeaders: [
      'No.',
      'Requester',
      'E-mail',
      'Relationship to the organisation',
      'Request type (Arts. 15-22)',
      'Received',
      'Response deadline (Art. 12(3))',
      'Deadline extended by 2 months',
      'Reason for the extension',
      'Status',
      'Completed',
      'Answered within the deadline (Art. 12(3))',
      'Ground for refusal (Art. 12(5)-(6))',
      'Refused at',
      'Identity verified',
      'How the identity was confirmed',
      'Data collection tasks (done / total)',
      'Notes',
      'Last updated',
      'System reference number',
    ],
    userHeaders: [
      'No.',
      'Full name',
      'Business e-mail',
      'PrivacyPilot permissions',
      'Account role',
      'Account active',
      'Has access to PrivacyPilot',
      'System reference number',
    ],
  },
};

/**
 * Everything a builder needs, worked out once: the wording, the delimiter, and small
 * helpers that all six registers use the same way.
 */
function toolkit(lang) {
  const w = TEXT[lang === 'pl' ? 'pl' : 'en'];
  const d = delimiterFor(lang);
  return {
    w,
    d,
    row: (values) => rowOf(values, d),
    yesNo: (value) => (value ? w.yes : w.no),
    orNotSet: (value) => orNotSet(value, lang),
    /**
     * An em dash for a value that is legitimately absent.
     *
     * Two different blanks must not look alike in a compliance document: `orNotSet` says
     * "this SHOULD have been filled in and was not" (a finding), while a dash says "there is
     * nothing here and that is fine" — an optional note, a reference that does not exist yet.
     * An empty cell says neither, and leaves the reader guessing which one it is.
     */
    dash: (value) => (value == null || value === '' ? '—' : value),
    date: (iso) => shortDate(iso, lang) || '—',
    stamp: (iso) => dateTime(iso, lang),
    // "Legitimate interest (Art. 6(1)(f))" — the meaning plus the citation an auditor looks
    // for. The reference comes from the shared list's own `ref`, so citations are written
    // one way everywhere in the product.
    withRef: (list, code) => {
      const entry = byId(list, code);
      if (!entry) return code ?? '';
      return entry.ref ? `${entry[lang] ?? code} (${entry.ref})` : (entry[lang] ?? code);
    },
    /**
     * A list of codes as readable labels in one cell.
     *
     * An EMPTY list says "brak" / "none" rather than leaving the cell blank: "no categories
     * of data were affected" is a real answer to an inspector's question, and a blank cell
     * cannot be told apart from one nobody got round to filling in.
     */
    labels: (codes, list) => ((codes ?? []).length > 0
      ? (codes ?? []).map((c) => labelOf(list, c, lang)).join(MULTI)
      : w.none),
  };
}

/** Assemble a whole file: provenance block, header row, then the data rows. */
function assemble({ settings, lang, registerTitle, rows, headers, filterSummary, exportedAt }) {
  const { row } = toolkit(lang);
  return joinCsv([
    ...provenanceLines({
      settings, lang, registerTitle, rowCount: rows.length, filterSummary, exportedAt,
    }),
    row(headers),
    ...rows,
  ]);
}

// ── Impact assessments (Art. 35) ─────────────────────────────────────────────────────

/**
 * @param {object}   p
 * @param {object}   p.settings    company + DPO details
 * @param {object[]} p.dpias       the assessments to include, as filtered on screen
 * @param {object[]} [p.activities] used to name each assessment's linked activity
 * @param {'pl'|'en'} p.lang
 * @param {(key: string) => string} p.t the app's translator, so statuses in the file read
 *                                      exactly as they do on screen
 * @returns {string} CSV text (no BOM — the download helper adds it)
 */
export function buildDpiaCsv({ settings, dpias = [], activities = [], lang, t, filterSummary, exportedAt }) {
  const k = toolkit(lang);
  const rows = dpias.map((dpia, i) => {
    const activity = activities.find((a) => a.id === dpia.activityId);
    const risks = dpia.risks ?? [];
    const approvals = dpia.approvals ?? [];
    const signed = approvals.filter((a) => a.approvedAt);
    /**
     * The worst risk is the number a reader looks for first — working it out from a list of
     * likelihood/severity pairs by hand is exactly where mistakes creep in.
     *
     * The score is written WITH its meaning ("20 (wysokie)"), because "20" on its own is not
     * an answer to "how bad is this?" for anyone who does not know the scale.
     */
    const worst = (pairs) => {
      if (pairs.length === 0) return k.w.noRisks;
      const score = Math.max(...pairs);
      return `${score} (${riskScoreLabel(score, lang)})`;
    };
    return k.row([
      i + 1,
      dpia.title,
      // An assessment not yet tied to a register entry is a real state, not a blank.
      k.dash(activity?.name),
      t(`status.${dpia.status}`),
      k.labels(dpia.criteriaMatched, DPIA_CRITERIA),
      k.orNotSet(dpia.description),
      k.orNotSet(dpia.necessity),
      risks.length,
      worst(risks.map((r) => (r.likelihood ?? 0) * (r.severity ?? 0))),
      worst(risks.map((r) => (r.residualLikelihood ?? 0) * (r.residualSeverity ?? 0))),
      (dpia.measures ?? []).length > 0 ? (dpia.measures ?? []).join(MULTI) : k.w.noMeasures,
      k.orNotSet(dpia.dpoAdvice),
      k.yesNo(dpia.priorConsultation),
      // "1 z 2" / "1 of 2" reads as a sentence; "1 / 2" reads as a fraction or a date.
      `${signed.length} ${k.w.of} ${approvals.length}`,
      // Who signed and when — the evidence that the assessment was actually approved,
      // rather than just a count. The role is spelled out, never the stored permission code.
      signed.length > 0
        ? signed.map((a) => `${roleLabel(a.role, lang)}: ${a.name} (${k.date(a.approvedAt)})`)
          .join(MULTI)
        : k.w.pending,
      k.date(dpia.updatedAt),
      dpia.id,
    ]);
  });

  return assemble({
    settings, lang, registerTitle: k.w.dpiaRegister, rows,
    headers: k.w.dpiaHeaders, filterSummary, exportedAt,
  });
}

// ── Processors (Art. 28) ─────────────────────────────────────────────────────────────

export function buildVendorCsv({ settings, vendors = [], lang, t, filterSummary, exportedAt }) {
  const k = toolkit(lang);
  const rows = vendors.map((v, i) => k.row([
    i + 1,
    v.name,
    k.orNotSet(v.country),
    k.orNotSet(v.region),
    // A missing agreement is a real Art. 28(3) finding, so it is spelled out in words
    // rather than left as a code the reader has to interpret.
    t(`vendors.dpa.${v.dpaStatus}`),
    v.riskLevel ? t(`risk.${v.riskLevel}`) : k.dash(),
    // Sub-processors are Art. 28(2)/(4); "none" is a real answer and must not look like a
    // cell someone forgot to fill in.
    (v.subprocessors ?? []).length > 0 ? (v.subprocessors ?? []).join(MULTI) : k.w.none,
    k.date(v.lastReviewAt),
    k.date(v.updatedAt),
    v.id,
  ]));

  return assemble({
    settings, lang, registerTitle: k.w.vendorRegister, rows,
    headers: k.w.vendorHeaders, filterSummary, exportedAt,
  });
}

// ── Transfers (Chapter V) ────────────────────────────────────────────────────────────

export function buildTransferCsv({ settings, transfers = [], vendors = [], lang, filterSummary, exportedAt }) {
  const k = toolkit(lang);
  const rows = transfers.map((tr, i) => {
    // An adequacy decision means no transfer impact assessment is needed — saying "No"
    // there would read as a finding when in fact nothing is missing.
    const needsTia = tr.mechanism !== 'adequacy';
    return k.row([
      i + 1,
      tr.recipient,
      // No linked processor is normal (the recipient was typed by hand), so it reads as a
      // dash rather than as a missing entry.
      tr.vendorId ? (vendors.find((v) => v.id === tr.vendorId)?.name ?? tr.vendorId) : k.dash(),
      k.orNotSet(tr.destinationCountry),
      k.withRef(TRANSFER_MECHANISMS, tr.mechanism),
      k.dash(tr.adequacyNote),
      needsTia ? k.yesNo(tr.tiaDocumented) : k.w.notRequired,
      needsTia ? k.dash(tr.tiaRef) : k.w.notRequired,
      k.date(tr.updatedAt),
      tr.id,
    ]);
  });

  return assemble({
    settings, lang, registerTitle: k.w.transferRegister, rows,
    headers: k.w.transferHeaders, filterSummary, exportedAt,
  });
}

// ── Breaches (Art. 33(5)) ────────────────────────────────────────────────────────────

export function buildBreachCsv({ settings, breaches = [], lang, t, filterSummary, exportedAt }) {
  const k = toolkit(lang);
  const rows = breaches.map((b, i) => {
    /**
     * Was UODO told within 72 hours of becoming aware (Art. 33(1))?
     *
     * This is the single question an inspector asks of a breach register, and it is a
     * comparison of two timestamps that a reader should not have to do by hand.
     */
    let within = k.w.notRequired;
    if (b.uodoNotificationRequired) {
      if (!b.uodoNotifiedAt) {
        within = k.w.pending;
      } else {
        const deadline = new Date(b.discoveredAt).getTime() + UODO_WINDOW_MS;
        within = new Date(b.uodoNotifiedAt).getTime() <= deadline ? k.w.onTime : k.w.late;
      }
    }
    const remediation = b.remediation ?? [];
    return k.row([
      i + 1,
      b.title,
      k.stamp(b.discoveredAt),
      t(`status.${b.status}`),
      b.riskLevel ? t(`risk.${b.riskLevel}`) : k.dash(),
      k.labels(b.dataCategories, DATA_CATEGORIES),
      // A count that was never filled in is NOT the same fact as a count of zero, so an
      // absent number says so rather than leaving the cell blank.
      k.orNotSet(b.subjectsCount),
      k.orNotSet(b.recordsCount),
      k.orNotSet(b.description),
      k.yesNo(b.uodoNotificationRequired),
      k.stamp(b.uodoNotifiedAt) || k.dash(),
      within,
      k.dash(b.uodoReference),
      k.yesNo(b.subjectsNotificationRequired),
      k.stamp(b.subjectsNotifiedAt) || k.dash(),
      k.orNotSet(b.riskRationale),
      // "[wykonano]" / "[w toku]", not "[Tak]" / "[Nie]" — a yes/no here reads as an answer
      // to "is this a measure?" rather than to "has it been done?".
      remediation.length > 0
        ? remediation.map((r) => `${r.text} [${r.done ? k.w.doneMark : k.w.pendingMark}]`).join(MULTI)
        : k.w.noMeasures,
      k.date(b.updatedAt),
      b.id,
    ]);
  });

  return assemble({
    settings, lang, registerTitle: k.w.breachRegister, rows,
    headers: k.w.breachHeaders, filterSummary, exportedAt,
  });
}

// ── Data subject requests (Arts. 12, 15-22) ──────────────────────────────────────────

export function buildDsarCsv({ settings, dsars = [], lang, t, filterSummary, exportedAt }) {
  const k = toolkit(lang);
  const rows = dsars.map((r, i) => {
    /**
     * Was the request answered by its Art. 12(3) deadline?
     *
     * Only meaningful once the request is finished: an open request is not late until its
     * deadline passes, and saying "NO — after the deadline" about a request that still has
     * two weeks to run would be plainly wrong.
     */
    let within = k.w.pending;
    const finishedAt = r.completedAt ?? r.refusedAt;
    if (finishedAt && r.dueAt) {
      within = new Date(finishedAt).getTime() <= new Date(r.dueAt).getTime()
        ? k.w.onTime : k.w.late;
    }
    const tasks = r.tasks ?? [];
    return k.row([
      i + 1,
      r.requesterName,
      k.dash(r.requesterEmail),
      k.dash(r.relation),
      k.withRef(DSAR_TYPES, r.type),
      k.date(r.receivedAt),
      k.date(r.dueAt),
      k.yesNo(r.extended),
      // Only asked for when the deadline was actually extended — an empty reason beside a
      // "No" reads as a missing answer rather than as "not applicable".
      r.extended ? k.orNotSet(r.extensionReason) : k.w.notRequired,
      t(`status.${r.status}`),
      k.date(r.completedAt),
      within,
      r.status === 'refused' ? k.orNotSet(r.refusalReason) : k.dash(r.refusalReason),
      k.date(r.refusedAt),
      k.yesNo(r.identityVerified),
      k.dash(r.identityMethod),
      // "0 / 0" is not readable — it looks like a fraction or a score. When there are no
      // tasks at all, say so in words.
      tasks.length > 0
        ? `${tasks.filter((task) => task.done).length} ${k.w.of} ${tasks.length}`
        : k.w.noTasks,
      k.dash(r.notes),
      k.date(r.updatedAt),
      r.id,
    ]);
  });

  return assemble({
    settings, lang, registerTitle: k.w.dsarRegister, rows,
    headers: k.w.dsarHeaders, filterSummary, exportedAt,
  });
}

// ── User access (Art. 32) ────────────────────────────────────────────────────────────

/**
 * Who can see this company's personal data, and with which permissions.
 *
 * Art. 32(1)(b)/(4) requires the controller to ensure only authorised people process
 * personal data; an access review is how that is demonstrated, and a reviewer needs the
 * list outside the app to sign it off.
 */
export function buildUserCsv({ settings, users = [], lang, filterSummary, exportedAt }) {
  const k = toolkit(lang);
  const rows = users.map((u, i) => k.row([
    i + 1,
    u.name,
    u.email,
    // Both role vocabularies go through the shared roleLabel, so an access reviewer never
    // has to decode "PRIVACYPILOT_COMPLIANCE_OFFICER" or "ROLE_ADMIN".
    (u.privacyPermissions ?? []).length > 0
      ? (u.privacyPermissions ?? []).map((p) => roleLabel(p, lang)).join(MULTI)
      : k.w.none,
    roleLabel(u.accountRole, lang) || k.dash(),
    k.yesNo(u.active),
    k.yesNo(u.hasAccess),
    u.id,
  ]));

  return assemble({
    settings, lang, registerTitle: k.w.userRegister, rows,
    headers: k.w.userHeaders, filterSummary, exportedAt,
  });
}

// ── File names ───────────────────────────────────────────────────────────────────────
// Readable, in the reader's language, and date-stamped so a folder of them sorts by date.
// Diacritics are deliberately avoided so the name survives being e-mailed, zipped, or
// opened on a system with a different code page.
const FILE_BASES = {
  dpia: { pl: 'Rejestr-DPIA', en: 'DPIA-register' },
  vendors: { pl: 'Rejestr-podmiotow-przetwarzajacych', en: 'Processor-register' },
  transfers: { pl: 'Rejestr-przekazan', en: 'Transfer-register' },
  breaches: { pl: 'Rejestr-naruszen', en: 'Breach-register' },
  dsar: { pl: 'Rejestr-zadan-osob', en: 'Data-subject-request-register' },
  users: { pl: 'Rejestr-dostepu-uzytkownikow', en: 'User-access-register' },
};

/** e.g. registerFilename('breaches', 'pl') → "Rejestr-naruszen-2026-08-03.csv" */
export function registerFilename(kind, lang, now = new Date()) {
  const base = FILE_BASES[kind]?.[lang === 'pl' ? 'pl' : 'en'] ?? kind;
  return csvFilename(base, now);
}
