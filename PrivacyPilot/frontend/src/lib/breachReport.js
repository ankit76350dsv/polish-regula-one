// Builds a clean, ready-to-submit UODO breach-notification report (Art. 33 GDPR)
// from a breach record + the company/DPO settings. This is DETERMINISTIC (not AI):
// every field is filled from real data, so the officer can copy/paste or attach it
// to UODO's official form (uodo.gov.pl). The optional AI "Draft notification" only
// helps write the free-text prose; THIS is the document of record.
import { DATA_CATEGORIES, labelOf } from './gdpr';

// A plain-language "likely consequences" line, chosen from the risk level. The
// officer should refine it, but it gives a correct Art. 33(3)(c) starting point.
function consequences(riskLevel, pl) {
  if (riskLevel === 'high') {
    return pl
      ? 'Wysokie ryzyko naruszenia praw lub wolności osób (np. kradzież tożsamości, strata finansowa, dyskryminacja).'
      : 'High risk to the rights and freedoms of individuals (e.g. identity theft, financial loss, discrimination).';
  }
  if (riskLevel === 'medium') {
    return pl
      ? 'Umiarkowane ryzyko dla osób; zastosowane środki ograniczają prawdopodobieństwo szkody.'
      : 'Some risk to individuals; the measures taken reduce the likelihood of harm.';
  }
  return pl
    ? 'Naruszenie raczej nie skutkuje ryzykiem naruszenia praw lub wolności osób.'
    : 'Unlikely to result in a risk to the rights and freedoms of individuals.';
}

const fmt = (iso, pl) => (iso ? new Date(iso).toLocaleString(pl ? 'pl-PL' : 'en-GB') : (pl ? '—' : '—'));
const orDash = (v) => (v == null || v === '' ? '—' : v);

/**
 * @returns {string} a Markdown document ready to copy/download.
 */
export function buildBreachReport({ breach, settings, lang }) {
  const pl = lang === 'pl';
  const company = settings?.company ?? {};
  const dpo = settings?.dpo ?? {};
  const preparedAt = new Date().toLocaleString(pl ? 'pl-PL' : 'en-GB');

  // "[set in Settings]" is shown when the company/DPO details are not filled yet.
  const missing = pl ? '[uzupełnij w Ustawieniach]' : '[set in Settings]';

  const categories = (breach.dataCategories ?? [])
    .map((c) => labelOf(DATA_CATEGORIES, c, lang)).join(', ') || '—';
  const measures = (breach.remediation ?? [])
    .map((r) => `- ${r.text} ${r.done ? (pl ? '[wykonano]' : '[done]') : (pl ? '[w toku]' : '[pending]')}`)
    .join('\n') || (pl ? '- [opisz środki zaradcze]' : '- [describe the measures]');
  const yesNo = (b) => (b ? (pl ? 'Tak' : 'Yes') : (pl ? 'Nie' : 'No'));

  const T = pl
    ? {
        head: 'ZGŁOSZENIE NARUSZENIA OCHRONY DANYCH OSOBOWYCH (art. 33 RODO)',
        prepared: 'Przygotowano', to: 'Do: Prezes UODO (uodo.gov.pl)',
        controller: '1. ADMINISTRATOR',
        name: 'Nazwa', address: 'Adres',
        dpo: '2. INSPEKTOR OCHRONY DANYCH (IOD) — art. 33(3)(b)',
        email: 'E-mail', phone: 'Telefon',
        breach: '3. NARUSZENIE', title: 'Tytuł',
        discovered: 'Stwierdzenie naruszenia (start biegu 72 h)', risk: 'Poziom ryzyka',
        nature: 'a) Charakter naruszenia — art. 33(3)(a)',
        cats: 'Kategorie danych', subjects: 'Przybliżona liczba osób', records: 'Przybliżona liczba wpisów/rekordów',
        conseq: 'c) Możliwe konsekwencje — art. 33(3)(c)',
        meas: 'd) Środki zastosowane/proponowane — art. 33(3)(d)',
        notif: '4. STATUS ZGŁOSZENIA',
        uodoReq: 'Wymagane zgłoszenie do UODO', uodoAt: 'Zgłoszono do UODO',
        ref: 'Sygnatura/numer sprawy UODO',
        subjReq: 'Wymagane zawiadomienie osób (art. 34)', subjAt: 'Zawiadomiono osoby',
        rationale: '5. UZASADNIENIE OCENY RYZYKA — art. 33(5)',
      }
    : {
        head: 'PERSONAL DATA BREACH NOTIFICATION (Art. 33 GDPR)',
        prepared: 'Prepared', to: 'To: President of UODO (uodo.gov.pl)',
        controller: '1. CONTROLLER',
        name: 'Name', address: 'Address',
        dpo: '2. DATA PROTECTION OFFICER (Art. 33(3)(b))',
        email: 'Email', phone: 'Phone',
        breach: '3. THE BREACH', title: 'Title',
        discovered: 'Became aware (start of the 72h clock)', risk: 'Risk level',
        nature: 'a) Nature of the breach (Art. 33(3)(a))',
        cats: 'Categories of data affected', subjects: 'Approx. number of data subjects', records: 'Approx. number of records',
        conseq: 'c) Likely consequences (Art. 33(3)(c))',
        meas: 'd) Measures taken / proposed (Art. 33(3)(d))',
        notif: '4. NOTIFICATION STATUS',
        uodoReq: 'UODO notification required', uodoAt: 'UODO notified at',
        ref: 'UODO reference / case no.',
        subjReq: 'Communication to data subjects required (Art. 34)', subjAt: 'Data subjects notified at',
        rationale: '5. RISK DECISION RATIONALE (Art. 33(5))',
      };

  return [
    `# ${T.head}`,
    `${T.prepared}: ${preparedAt}  |  ${T.to}`,
    '',
    `## ${T.controller}`,
    `${T.name}: ${orDash(company.name) === '—' ? missing : company.name}`,
    `${T.address}: ${orDash(company.address) === '—' ? missing : company.address}`,
    `NIP: ${orDash(company.nip)}   REGON: ${orDash(company.regon)}`,
    '',
    `## ${T.dpo}`,
    `${orDash(dpo.name) === '—' ? missing : dpo.name}`,
    `${T.email}: ${orDash(dpo.email) === '—' ? missing : dpo.email}   ${T.phone}: ${orDash(dpo.phone)}`,
    '',
    `## ${T.breach}`,
    `${T.title}: ${orDash(breach.title)}`,
    `${T.discovered}: ${fmt(breach.discoveredAt, pl)}`,
    `${T.risk}: ${orDash(breach.riskLevel)}`,
    '',
    `### ${T.nature}`,
    `${orDash(breach.description)}`,
    '',
    `**${T.cats}:** ${categories}`,
    `**${T.subjects}:** ${orDash(breach.subjectsCount)}`,
    `**${T.records}:** ${breach.recordsCount != null ? breach.recordsCount : '—'}`,
    '',
    `### ${T.conseq}`,
    consequences(breach.riskLevel, pl),
    '',
    `### ${T.meas}`,
    measures,
    '',
    `## ${T.notif}`,
    `${T.uodoReq}: ${yesNo(breach.uodoNotificationRequired)}`,
    `${T.uodoAt}: ${fmt(breach.uodoNotifiedAt, pl)}`,
    `${T.ref}: ${orDash(breach.uodoReference)}`,
    `${T.subjReq}: ${yesNo(breach.subjectsNotificationRequired)}`,
    `${T.subjAt}: ${fmt(breach.subjectsNotifiedAt, pl)}`,
    '',
    `## ${T.rationale}`,
    `${orDash(breach.riskRationale)}`,
    '',
  ].join('\n');
}
