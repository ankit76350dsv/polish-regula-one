// Builds the impact-assessment REPORT for one DPIA (Art. 35(7) GDPR).
//
// WHY A DOCUMENT AND NOT JUST A ROW: Art. 35(7) says the assessment "shall contain at
// least" four things — (a) a systematic description of the processing, (b) an assessment of
// necessity and proportionality, (c) an assessment of the risks, and (d) the measures
// envisaged to address those risks. Art. 36 then requires the controller to consult the
// supervisory authority BEFORE processing where the residual risk stays high, and Art. 36(3)
// obliges them to hand the authority the assessment itself. A spreadsheet row cannot serve
// that purpose; a document can.
//
// This is DETERMINISTIC, not AI: every line is filled from the stored record, so it is the
// document of record. The optional AI helpers on the DPIA screen only draft the prose that
// the human then reviews and saves — by the time it reaches here it is the company's own
// text, not a suggestion.
//
// Structured exactly like breachReport.js (its sibling), so the two documents this product
// produces for a regulator read alike.
import { labelOf } from './gdpr';
// riskScoreLabel keeps the matrix thresholds in ONE place, shared with the exported DPIA
// register, so the words in the document and the colours on screen can never disagree.
import { DPIA_CRITERIA, riskScoreLabel } from './dpiaCriteria';
import { roleLabel } from './permissions';

const orDash = (v) => (v == null || v === '' ? '—' : v);
const fmtDate = (iso, pl) => (iso ? new Date(iso).toLocaleDateString(pl ? 'pl-PL' : 'en-GB') : '—');

/**
 * @param {object}   p
 * @param {object}   p.dpia      the assessment
 * @param {object}   [p.activity] the processing activity it is about, for the description
 * @param {object}   [p.settings] company + DPO details
 * @param {'pl'|'en'} p.lang
 * @param {(key: string) => string} [p.t] the app's translator, so the status reads exactly as
 *                                        it does on screen ("Approved", not "approved")
 * @returns {string} a Markdown document ready to download, open in Word, or print.
 */
export function buildDpiaReport({ dpia, activity, settings, lang, t }) {
  const pl = lang === 'pl';
  const company = settings?.company ?? {};
  const dpo = settings?.dpo ?? {};
  const preparedAt = new Date().toLocaleString(pl ? 'pl-PL' : 'en-GB');
  // Shown when the company/DPO details have not been filled in yet, so the gap is obvious
  // rather than silently blank.
  const missing = pl ? '[uzupełnij w Ustawieniach]' : '[set in Settings]';

  const T = pl
    ? {
        head: 'OCENA SKUTKÓW DLA OCHRONY DANYCH (DPIA) — art. 35 RODO',
        prepared: 'Przygotowano',
        controller: '1. ADMINISTRATOR',
        name: 'Nazwa', address: 'Adres',
        dpo: '2. INSPEKTOR OCHRONY DANYCH (IOD) — art. 35 ust. 2',
        email: 'E-mail', phone: 'Telefon',
        subject: '3. PRZEDMIOT OCENY',
        title: 'Tytuł oceny', activity: 'Czynność przetwarzania', status: 'Status oceny',
        purpose: 'Cel przetwarzania',
        criteria: '4. PODSTAWA PRZEPROWADZENIA OCENY — art. 35 ust. 3 / M.P. 2019 poz. 666',
        criteriaNote: 'Spełnione kryteria kwalifikujące:',
        noCriteria: '- [nie wskazano kryteriów]',
        description: '5. SYSTEMATYCZNY OPIS PRZETWARZANIA — art. 35 ust. 7 lit. a',
        necessity: '6. NIEZBĘDNOŚĆ I PROPORCJONALNOŚĆ — art. 35 ust. 7 lit. b',
        risks: '7. OCENA RYZYKA — art. 35 ust. 7 lit. c',
        noRisks: '[nie zidentyfikowano ryzyk]',
        riskCol: 'Ryzyko', inherent: 'Ryzyko pierwotne', mitigation: 'Środki ograniczające',
        residual: 'Ryzyko szczątkowe',
        measures: '8. ŚRODKI ZARADCZE — art. 35 ust. 7 lit. d',
        noMeasures: '- [opisz zaplanowane środki]',
        advice: '9. OPINIA INSPEKTORA OCHRONY DANYCH — art. 35 ust. 2',
        noAdvice: '[opinia IOD nie została jeszcze wydana]',
        consult: '10. UPRZEDNIE KONSULTACJE Z ORGANEM NADZORCZYM — art. 36',
        consultYes: 'WYMAGANE. Ryzyko szczątkowe pozostaje wysokie — przed rozpoczęciem '
          + 'przetwarzania należy skonsultować się z Prezesem UODO (art. 36 ust. 1). '
          + 'Na żądanie organu należy przekazać niniejszą ocenę (art. 36 ust. 3 lit. e).',
        consultNo: 'Nie wskazano potrzeby uprzednich konsultacji z organem nadzorczym.',
        approvals: '11. ZATWIERDZENIE',
        pending: 'oczekuje na podpis',
        noApprovals: '[brak wymaganych podpisów]',
      }
    : {
        head: 'DATA PROTECTION IMPACT ASSESSMENT (DPIA) — Art. 35 GDPR',
        prepared: 'Prepared',
        controller: '1. CONTROLLER',
        name: 'Name', address: 'Address',
        dpo: '2. DATA PROTECTION OFFICER (Art. 35(2))',
        email: 'Email', phone: 'Phone',
        subject: '3. SUBJECT OF THE ASSESSMENT',
        title: 'Assessment title', activity: 'Processing activity', status: 'Assessment status',
        purpose: 'Purpose of the processing',
        criteria: '4. WHY THIS ASSESSMENT WAS CARRIED OUT — Art. 35(3) / M.P. 2019 item 666',
        criteriaNote: 'Triggering criteria met:',
        noCriteria: '- [no criteria recorded]',
        description: '5. SYSTEMATIC DESCRIPTION OF THE PROCESSING — Art. 35(7)(a)',
        necessity: '6. NECESSITY AND PROPORTIONALITY — Art. 35(7)(b)',
        risks: '7. ASSESSMENT OF THE RISKS — Art. 35(7)(c)',
        noRisks: '[no risks identified]',
        riskCol: 'Risk', inherent: 'Inherent risk', mitigation: 'Mitigating measures',
        residual: 'Residual risk',
        measures: '8. MEASURES ENVISAGED — Art. 35(7)(d)',
        noMeasures: '- [describe the measures envisaged]',
        advice: '9. ADVICE OF THE DATA PROTECTION OFFICER — Art. 35(2)',
        noAdvice: '[the DPO has not given advice yet]',
        consult: '10. PRIOR CONSULTATION WITH THE SUPERVISORY AUTHORITY — Art. 36',
        consultYes: 'REQUIRED. The residual risk remains high, so the President of UODO must '
          + 'be consulted BEFORE the processing starts (Art. 36(1)). On request, this '
          + 'assessment must be provided to the authority (Art. 36(3)(e)).',
        consultNo: 'No need for prior consultation with the supervisory authority was identified.',
        approvals: '11. APPROVAL',
        pending: 'awaiting signature',
        noApprovals: '[no approvals required]',
      };

  const criteria = (dpia.criteriaMatched ?? []).length > 0
    ? (dpia.criteriaMatched ?? []).map((c) => `- ${labelOf(DPIA_CRITERIA, c, lang)}`).join('\n')
    : T.noCriteria;

  // Each risk is written out with BOTH scores and what each one means in words — a bare
  // "4x5 = 20" tells a lawyer nothing on its own.
  const risks = (dpia.risks ?? []).length > 0
    ? (dpia.risks ?? []).map((r, i) => {
        const score = (r.likelihood ?? 0) * (r.severity ?? 0);
        const residual = (r.residualLikelihood ?? 0) * (r.residualSeverity ?? 0);
        return [
          `### ${T.riskCol} ${i + 1}: ${orDash(r.description)}`,
          `- **${T.inherent}:** ${r.likelihood} x ${r.severity} = ${score} (${riskScoreLabel(score, lang)})`,
          `- **${T.mitigation}:** ${orDash(r.mitigation)}`,
          `- **${T.residual}:** ${r.residualLikelihood} x ${r.residualSeverity} = ${residual} (${riskScoreLabel(residual, lang)})`,
        ].join('\n');
      }).join('\n\n')
    : T.noRisks;

  const measures = (dpia.measures ?? []).length > 0
    ? (dpia.measures ?? []).map((m) => `- ${m}`).join('\n')
    : T.noMeasures;

  const approvals = (dpia.approvals ?? []).length > 0
    ? (dpia.approvals ?? []).map((a) => {
        const role = roleLabel(a.role, lang);
        return a.approvedAt
          ? `- ${role}: ${a.name} — ${fmtDate(a.approvedAt, pl)}`
          : `- ${role}: ${T.pending}`;
      }).join('\n')
    : T.noApprovals;

  return [
    `# ${T.head}`,
    `${T.prepared}: ${preparedAt}`,
    '',
    `## ${T.controller}`,
    `${T.name}: ${company.name || missing}`,
    `${T.address}: ${company.address || missing}`,
    `NIP: ${orDash(company.nip)}   REGON: ${orDash(company.regon)}`,
    '',
    `## ${T.dpo}`,
    `${dpo.name || missing}`,
    `${T.email}: ${dpo.email || missing}   ${T.phone}: ${orDash(dpo.phone)}`,
    '',
    `## ${T.subject}`,
    `${T.title}: ${orDash(dpia.title)}`,
    `${T.activity}: ${orDash(activity?.name)}`,
    `${T.purpose}: ${orDash(activity?.purpose)}`,
    // Translated, so the document never shows a stored code like "in_review".
    `${T.status}: ${dpia.status ? (t ? t(`status.${dpia.status}`) : dpia.status) : '—'}`,
    '',
    `## ${T.criteria}`,
    T.criteriaNote,
    criteria,
    '',
    `## ${T.description}`,
    orDash(dpia.description),
    '',
    `## ${T.necessity}`,
    orDash(dpia.necessity),
    '',
    `## ${T.risks}`,
    risks,
    '',
    `## ${T.measures}`,
    measures,
    '',
    `## ${T.advice}`,
    dpia.dpoAdvice || T.noAdvice,
    '',
    `## ${T.consult}`,
    dpia.priorConsultation ? T.consultYes : T.consultNo,
    '',
    `## ${T.approvals}`,
    approvals,
    '',
  ].join('\n');
}
