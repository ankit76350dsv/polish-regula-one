// Builds the CASE FILE for one data subject request (Arts. 12 and 15-22 GDPR).
//
// WHY THIS DOCUMENT EXISTS: when someone complains to UODO that their request was ignored,
// the company has to show what it actually did — when the request arrived, how the person's
// identity was confirmed, what was collected, whether the one-month deadline was met or
// properly extended under Art. 12(3), and, if the request was refused, the legal ground for
// that under Art. 12(5)-(6). Those facts are spread across a workspace screen; this puts
// them in one document that can be filed, printed, or attached to a reply.
//
// ⚠ THIS DOCUMENT IS ABOUT AN IDENTIFIED PERSON. It contains the requester's name, e-mail
// and relationship to the company, so it is the most personal export the product produces.
// Two consequences, both deliberate:
//   • every copy is recorded in the audit trail before the file is handed over (Art. 5(2)),
//     the same "no evidence, no copy" rule as every other export;
//   • the FILE NAME carries no personal data — it is named after the request type and date,
//     never the requester — because file names end up in folders, e-mail attachments and
//     backup indexes where they are far harder to control than the file's contents.
//
// This is DETERMINISTIC, not AI: every line comes from the stored record. The separate
// "Draft reply" helper on the DSAR screen writes prose TO the requester; this is the
// internal record of how the case was handled.
import { DSAR_TYPES, byId, labelOf } from './gdpr';

const orDash = (v) => (v == null || v === '' ? '—' : v);
const fmtDate = (iso, pl) => (iso ? new Date(iso).toLocaleDateString(pl ? 'pl-PL' : 'en-GB') : '—');
const fmtStamp = (iso, pl) => (iso ? new Date(iso).toLocaleString(pl ? 'pl-PL' : 'en-GB') : '—');

/**
 * @param {object}   p
 * @param {object}   p.dsar      the request
 * @param {object}   [p.settings] company + DPO details
 * @param {'pl'|'en'} p.lang
 * @param {(key: string) => string} p.t the app's translator, so the status reads exactly as
 *                                      it does on screen
 * @returns {string} a Markdown document ready to download, open in Word, or print.
 */
export function buildDsarCaseFile({ dsar, settings, lang, t }) {
  const pl = lang === 'pl';
  const company = settings?.company ?? {};
  const dpo = settings?.dpo ?? {};
  const preparedAt = new Date().toLocaleString(pl ? 'pl-PL' : 'en-GB');
  const missing = pl ? '[uzupełnij w Ustawieniach]' : '[set in Settings]';
  const typeMeta = byId(DSAR_TYPES, dsar.type);
  const yesNo = (v) => (v ? (pl ? 'Tak' : 'Yes') : (pl ? 'Nie' : 'No'));

  const T = pl
    ? {
        head: 'AKTA SPRAWY — ŻĄDANIE OSOBY, KTÓREJ DANE DOTYCZĄ',
        subhead: 'art. 12 oraz art. 15-22 RODO',
        prepared: 'Przygotowano',
        confidential: 'DOKUMENT ZAWIERA DANE OSOBOWE — do użytku wewnętrznego i na żądanie organu nadzorczego.',
        controller: '1. ADMINISTRATOR',
        name: 'Nazwa', address: 'Adres',
        dpo: '2. INSPEKTOR OCHRONY DANYCH (IOD)',
        email: 'E-mail', phone: 'Telefon',
        request: '3. ŻĄDANIE',
        type: 'Rodzaj żądania', requester: 'Osoba składająca żądanie',
        contact: 'Kontakt', relation: 'Relacja z organizacją',
        received: 'Data otrzymania', status: 'Status',
        identity: '4. POTWIERDZENIE TOŻSAMOŚCI',
        identityNote: 'Weryfikacja proporcjonalna — żądano wyłącznie danych niezbędnych do '
          + 'potwierdzenia tożsamości (art. 12 ust. 6).',
        verified: 'Tożsamość potwierdzona', method: 'Sposób potwierdzenia',
        deadline: '5. TERMIN ODPOWIEDZI — art. 12 ust. 3',
        due: 'Termin odpowiedzi', extended: 'Termin przedłużony o 2 miesiące',
        extReason: 'Uzasadnienie przedłużenia',
        extNote: 'O przedłużeniu i jego przyczynach osobę należy poinformować w ciągu '
          + 'pierwszego miesiąca (art. 12 ust. 3).',
        outcomeOnTime: 'Sprawę zakończono W TERMINIE.',
        outcomeLate: 'Sprawę zakończono PO TERMINIE.',
        outcomeOpen: 'Sprawa w toku — termin jeszcze nie upłynął lub sprawa nie została zamknięta.',
        tasks: '6. ZAKRES ZEBRANYCH DANYCH',
        noTasks: '[nie zapisano zadań zbierania danych]',
        done: 'wykonano', pendingTask: 'w toku',
        outcome: '7. ROZSTRZYGNIĘCIE',
        completedAt: 'Data realizacji',
        refusal: 'Podstawa odmowy — art. 12 ust. 5-6',
        refusedAt: 'Data odmowy',
        refusalNote: 'W przypadku odmowy osobę należy poinformować o przyczynach oraz o prawie '
          + 'wniesienia skargi do Prezesa UODO i skorzystania ze środków ochrony prawnej '
          + 'przed sądem (art. 12 ust. 4).',
        notes: '8. UWAGI',
      }
    : {
        head: 'CASE FILE — DATA SUBJECT REQUEST',
        subhead: 'Arts. 12 and 15-22 GDPR',
        prepared: 'Prepared',
        confidential: 'THIS DOCUMENT CONTAINS PERSONAL DATA — for internal use and for the '
          + 'supervisory authority on request.',
        controller: '1. CONTROLLER',
        name: 'Name', address: 'Address',
        dpo: '2. DATA PROTECTION OFFICER',
        email: 'Email', phone: 'Phone',
        request: '3. THE REQUEST',
        type: 'Request type', requester: 'Requester',
        contact: 'Contact', relation: 'Relationship to the organisation',
        received: 'Received', status: 'Status',
        identity: '4. IDENTITY VERIFICATION',
        identityNote: 'Verified proportionately — only the information necessary to confirm '
          + 'the requester’s identity was asked for (Art. 12(6)).',
        verified: 'Identity verified', method: 'How it was confirmed',
        deadline: '5. RESPONSE DEADLINE — Art. 12(3)',
        due: 'Response due', extended: 'Extended by 2 months',
        extReason: 'Reason for the extension',
        extNote: 'The requester must be told of the extension and its reasons within the '
          + 'first month (Art. 12(3)).',
        outcomeOnTime: 'The case was closed WITHIN the deadline.',
        outcomeLate: 'The case was closed AFTER the deadline.',
        outcomeOpen: 'Case still open — the deadline has not passed, or the case is not closed.',
        tasks: '6. DATA COLLECTED',
        noTasks: '[no data collection tasks recorded]',
        done: 'done', pendingTask: 'pending',
        outcome: '7. OUTCOME',
        completedAt: 'Completed',
        refusal: 'Ground for refusal — Art. 12(5)-(6)',
        refusedAt: 'Refused at',
        refusalNote: 'Where a request is refused, the requester must be informed of the '
          + 'reasons and of their right to lodge a complaint with the President of UODO and '
          + 'to seek a judicial remedy (Art. 12(4)).',
        notes: '8. NOTES',
      };

  const tasks = (dsar.tasks ?? []).length > 0
    ? (dsar.tasks ?? []).map((task) =>
        `- ${task.text} [${task.done ? T.done : T.pendingTask}]`).join('\n')
    : T.noTasks;

  // Was the case closed by its deadline? Stated in words rather than leaving the reader to
  // compare two dates — this is the question a complaint turns on.
  const finishedAt = dsar.completedAt ?? dsar.refusedAt;
  let timeliness = T.outcomeOpen;
  if (finishedAt && dsar.dueAt) {
    timeliness = new Date(finishedAt).getTime() <= new Date(dsar.dueAt).getTime()
      ? T.outcomeOnTime : T.outcomeLate;
  }

  const lines = [
    `# ${T.head}`,
    `_${T.subhead}_`,
    `${T.prepared}: ${preparedAt}`,
    '',
    `> ${T.confidential}`,
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
    `## ${T.request}`,
    `${T.type}: ${labelOf(DSAR_TYPES, dsar.type, lang)} (${orDash(typeMeta?.ref)})`,
    `${T.requester}: ${orDash(dsar.requesterName)}`,
    `${T.contact}: ${orDash(dsar.requesterEmail)}`,
    `${T.relation}: ${orDash(dsar.relation)}`,
    `${T.received}: ${fmtDate(dsar.receivedAt, pl)}`,
    `${T.status}: ${t(`status.${dsar.status}`)}`,
    '',
    `## ${T.identity}`,
    T.identityNote,
    '',
    `${T.verified}: ${yesNo(dsar.identityVerified)}`,
    `${T.method}: ${orDash(dsar.identityMethod)}`,
    '',
    `## ${T.deadline}`,
    `${T.due}: ${fmtDate(dsar.dueAt, pl)}`,
    `${T.extended}: ${yesNo(dsar.extended)}`,
  ];

  // Only print the extension paragraph when the deadline was actually extended — an empty
  // "Reason:" line under a "No" reads as a missing answer.
  if (dsar.extended) {
    lines.push(`${T.extReason}: ${orDash(dsar.extensionReason)}`);
    lines.push('', T.extNote);
  }

  lines.push(
    '',
    timeliness,
    '',
    `## ${T.tasks}`,
    tasks,
    '',
    `## ${T.outcome}`,
    `${T.status}: ${t(`status.${dsar.status}`)}`,
    `${T.completedAt}: ${fmtStamp(dsar.completedAt, pl)}`,
  );

  // The refusal block, with its Art. 12(4) obligation, only when the request was refused.
  if (dsar.status === 'refused' || dsar.refusalReason) {
    lines.push(
      '',
      `${T.refusal}:`,
      orDash(dsar.refusalReason),
      `${T.refusedAt}: ${fmtStamp(dsar.refusedAt, pl)}`,
      '',
      T.refusalNote,
    );
  }

  lines.push('', `## ${T.notes}`, orDash(dsar.notes), '');
  return lines.join('\n');
}
