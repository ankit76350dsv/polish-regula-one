// Privacy-notice engine — compiles Arts. 13/14 information duties from live
// register data, per audience. Pure functions: easy to unit-test, no I/O.
//
// Design rule carried over from the validation report: generation is BLOCKED
// until every mandatory Art. 13/14 item can actually be filled from data.
// No silent gaps — a notice with missing mandatory content is a GDPR breach,
// not a convenience.

import {
  ART6_BASES, ART9_CONDITIONS, DATA_CATEGORIES, RECIPIENT_CATEGORIES,
  TRANSFER_MECHANISMS, NOTICE_AUDIENCES, NOTICE_REQUIRED_ITEMS, labelOf, byId,
} from './gdpr';

// Which register data subjects feed which audience's notice.
const AUDIENCE_SUBJECTS = {
  website: ['website_users'],
  employees: ['employees'],
  candidates: ['candidates'],
  contractors: ['contractors', 'suppliers'],
  whistleblowers: ['whistleblowers'],
};

/** Controller activities relevant for one audience. */
export function activitiesForAudience(activities, audienceId) {
  const subjects = AUDIENCE_SUBJECTS[audienceId] ?? [];
  return activities.filter(
    (a) =>
      a.role === 'controller' &&
      a.status !== 'archived' &&
      a.dataSubjects?.some((s) => subjects.includes(s)),
  );
}

/**
 * Compute the Art. 13/14 completeness checklist for an audience.
 * Returns [{ id, ref, ok, details }] — `ok: false` on any mandatory item
 * blocks generation.
 */
export function buildChecklist({ settings, activities, audienceId }) {
  const audience = byId(NOTICE_AUDIENCES, audienceId);
  const relevant = activitiesForAudience(activities, audienceId);
  const isArt14 = audience?.art === 14;
  const isArt13 = audience?.art === 13;

  const results = [];
  const push = (id, ok, details = '') => {
    const item = byId(NOTICE_REQUIRED_ITEMS, id);
    results.push({ id, ref: item?.ref, ok, details });
  };

  push('controller_identity',
    Boolean(settings.company?.name && settings.company?.address),
    'Company name and registered address (Settings → Company)');

  push('dpo_contact',
    Boolean(settings.dpo?.email),
    'DPO e-mail (Settings → DPO)');

  const noPurpose = relevant.filter((a) => !a.purpose || !a.lawfulBasis);
  push('purposes_basis', relevant.length > 0 && noPurpose.length === 0,
    relevant.length === 0
      ? 'No register activities cover this audience — record them first'
      : noPurpose.map((a) => a.name).join(', '));

  const liMissing = relevant.filter(
    (a) => a.lawfulBasis === 'legitimate_interest' && !a.legitimateInterestDetail,
  );
  push('legitimate_interest', liMissing.length === 0, liMissing.map((a) => a.name).join(', '));

  push('recipients', true, ''); // always expressible: lists recipients or states none

  const transferring = relevant.filter((a) => a.transfer);
  const transfersIncomplete = transferring.filter(
    (a) => !(a.transferIds?.length),
  );
  push('transfers', transfersIncomplete.length === 0,
    transfersIncomplete.map((a) => a.name).join(', '));

  const noRetention = relevant.filter((a) => !a.retentionPeriod);
  push('retention', noRetention.length === 0, noRetention.map((a) => a.name).join(', '));

  push('rights', true, '');

  push('withdraw_consent', true, ''); // included automatically when consent is a basis

  push('complaint', true, '');

  // Art. 13(2)(e) — only mandatory for data collected from the subject (Art. 13).
  if (isArt13) {
    const noProvision = relevant.filter((a) => !a.provisionStatement);
    push('provision_requirement', noProvision.length === 0, noProvision.map((a) => a.name).join(', '));
  }

  if (isArt14) {
    // Art. 14(1)(d) — categories of personal data must be stated when the data
    // was not obtained from the subject. Expressible from register data.
    const noCategories = relevant.filter((a) => !(a.dataCategories?.length));
    push('data_categories', relevant.length > 0 && noCategories.length === 0,
      noCategories.map((a) => a.name).join(', '));

    const noSource = relevant.filter((a) => !(a.dataSources?.length));
    push('source', noSource.length === 0, noSource.map((a) => a.name).join(', '));
  }

  const admActivities = relevant.filter((a) =>
    a.dpiaCriteria?.some((c) => c === 'automated_decisions' || c === 'evaluation_scoring'),
  );
  const admMissing = admActivities.filter((a) => !a.admStatement);
  push('automated_decisions', admMissing.length === 0,
    admMissing.map((a) => `${a.name} — describe the logic and consequences`).join(', '));

  return { audience, relevant, checklist: results, blocked: results.some((r) => !r.ok) };
}

const L = {
  pl: {
    title: (aud) => `Klauzula informacyjna — ${aud.pl}`,
    intro: 'Zgodnie z art. 13 i 14 RODO informujemy o zasadach przetwarzania Państwa danych osobowych.',
    controller: 'Administrator danych',
    dpo: 'Inspektor Ochrony Danych (IOD)',
    purposes: 'Cele, podstawy prawne i okresy przechowywania',
    purpose: 'Cel', basis: 'Podstawa prawna', retention: 'Okres przechowywania',
    li: 'Prawnie uzasadnione interesy',
    recipients: 'Odbiorcy danych',
    noRecipients: 'Dane nie są przekazywane innym odbiorcom.',
    transfers: 'Przekazywanie danych do państw trzecich',
    noTransfers: 'Dane nie są przekazywane poza Europejski Obszar Gospodarczy.',
    rights: 'Państwa prawa',
    rightsText: 'Przysługuje Państwu prawo dostępu do danych (art. 15), sprostowania (art. 16), usunięcia (art. 17), ograniczenia przetwarzania (art. 18), przenoszenia danych (art. 20) oraz sprzeciwu (art. 21).',
    withdraw: 'Jeżeli przetwarzanie odbywa się na podstawie zgody, mogą ją Państwo wycofać w każdym czasie (art. 7(3)); wycofanie nie wpływa na zgodność z prawem wcześniejszego przetwarzania.',
    complaint: 'Skarga do organu nadzorczego',
    complaintText: 'Mają Państwo prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych, ul. Stawki 2, 00-193 Warszawa.',
    provision: 'Obowiązek podania danych',
    categories: 'Kategorie przetwarzanych danych',
    source: 'Źródło danych',
    adm: 'Zautomatyzowane podejmowanie decyzji',
    noAdm: 'Dane nie podlegają zautomatyzowanemu podejmowaniu decyzji, w tym profilowaniu wywołującemu skutki prawne.',
    special: 'Szczególne kategorie danych (art. 9)',
  },
  en: {
    title: (aud) => `Privacy notice — ${aud.en}`,
    intro: 'Pursuant to Articles 13 and 14 GDPR, we inform you how your personal data is processed.',
    controller: 'Data controller',
    dpo: 'Data Protection Officer (DPO)',
    purposes: 'Purposes, legal bases and retention periods',
    purpose: 'Purpose', basis: 'Legal basis', retention: 'Retention period',
    li: 'Legitimate interests pursued',
    recipients: 'Recipients of the data',
    noRecipients: 'Data is not disclosed to other recipients.',
    transfers: 'Transfers to third countries',
    noTransfers: 'Data is not transferred outside the European Economic Area.',
    rights: 'Your rights',
    rightsText: 'You have the right of access (Art. 15), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18), data portability (Art. 20) and objection (Art. 21).',
    withdraw: 'Where processing is based on consent, you may withdraw it at any time (Art. 7(3)); withdrawal does not affect the lawfulness of prior processing.',
    complaint: 'Complaint to the supervisory authority',
    complaintText: 'You have the right to lodge a complaint with the President of the Personal Data Protection Office (UODO), ul. Stawki 2, 00-193 Warszawa, Poland.',
    provision: 'Whether providing data is required',
    categories: 'Categories of personal data processed',
    source: 'Source of the data',
    adm: 'Automated decision-making',
    noAdm: 'Your data is not subject to automated decision-making, including profiling, producing legal effects.',
    special: 'Special categories of data (Art. 9)',
  },
};

/** Compose the notice document (Markdown) from register data. */
export function buildNoticeContent({ settings, activities, transfers, vendors, audienceId, language }) {
  const { audience, relevant } = buildChecklist({ settings, activities, audienceId });
  const s = L[language] ?? L.pl;
  const lang = language;
  const lines = [];

  lines.push(`# ${s.title(audience)}`);
  lines.push('');
  lines.push(s.intro);
  lines.push('');
  lines.push(`## ${s.controller}`);
  lines.push(`${settings.company.name}, ${settings.company.address}, NIP ${settings.company.nip}.`);
  lines.push('');
  lines.push(`## ${s.dpo}`);
  // Guard the name so a blank DPO name never prints "undefined — <email>".
  lines.push(`${settings.dpo.name ? `${settings.dpo.name} — ` : ''}${settings.dpo.email}${settings.dpo.phone ? `, ${settings.dpo.phone}` : ''}.`);
  lines.push('');
  lines.push(`## ${s.purposes}`);
  for (const a of relevant) {
    const basis = byId(ART6_BASES, a.lawfulBasis);
    lines.push(`### ${a.name}`);
    lines.push(`- **${s.purpose}:** ${a.purpose}`);
    lines.push(`- **${s.basis}:** ${basis ? `${basis[lang]} (${basis.ref})` : '—'}`);
    if (a.lawfulBasis === 'legitimate_interest' && a.legitimateInterestDetail) {
      lines.push(`- **${s.li}:** ${a.legitimateInterestDetail}`);
    }
    if (a.art9Condition) {
      const cond = byId(ART9_CONDITIONS, a.art9Condition);
      lines.push(`- **${s.special}:** ${cond ? `${cond[lang]} (${cond.ref})` : '—'}`);
    }
    lines.push(`- **${s.retention}:** ${a.retentionPeriod}${a.retentionBasis ? ` — ${a.retentionBasis}` : ''}`);
    lines.push('');
  }

  lines.push(`## ${s.recipients}`);
  const recipientIds = [...new Set(relevant.flatMap((a) => a.recipients ?? []))];
  const vendorIds = [...new Set(relevant.flatMap((a) => a.vendorIds ?? []))];
  const vendorNames = vendorIds
    .map((id) => vendors.find((v) => v.id === id)?.name)
    .filter(Boolean);
  const recipientLabels = recipientIds.map((id) => labelOf(RECIPIENT_CATEGORIES, id, lang));
  const allRecipients = [...recipientLabels, ...vendorNames];
  lines.push(allRecipients.length ? allRecipients.map((r) => `- ${r}`).join('\n') : s.noRecipients);
  lines.push('');

  lines.push(`## ${s.transfers}`);
  const transferIds = [...new Set(relevant.flatMap((a) => a.transferIds ?? []))];
  const relevantTransfers = transfers.filter((t) => transferIds.includes(t.id));
  if (relevantTransfers.length) {
    for (const t of relevantTransfers) {
      const mech = byId(TRANSFER_MECHANISMS, t.mechanism);
      lines.push(`- ${t.recipient} — ${t.destinationCountry}: ${mech ? `${mech[lang]} (${mech.ref})` : t.mechanism}`);
    }
  } else {
    lines.push(s.noTransfers);
  }
  lines.push('');

  lines.push(`## ${s.rights}`);
  lines.push(s.rightsText);
  if (relevant.some((a) => a.lawfulBasis === 'consent')) {
    lines.push('');
    lines.push(s.withdraw);
  }
  lines.push('');
  lines.push(`## ${s.complaint}`);
  lines.push(s.complaintText);
  lines.push('');
  // Art. 13(2)(e) provision requirement — only for data collected from the subject.
  if (audience.art === 13) {
    lines.push(`## ${s.provision}`);
    for (const a of relevant) {
      if (a.provisionStatement) lines.push(`- **${a.name}:** ${a.provisionStatement}`);
    }
    lines.push('');
  }

  if (audience.art === 14) {
    // Art. 14(1)(d): categories of personal data (the subject did not supply it).
    lines.push(`## ${s.categories}`);
    for (const a of relevant) {
      const cats = (a.dataCategories ?? []).map((c) => labelOf(DATA_CATEGORIES, c, lang));
      if (cats.length) lines.push(`- **${a.name}:** ${cats.join(', ')}`);
    }
    lines.push('');

    lines.push(`## ${s.source}`);
    for (const a of relevant) {
      if (a.dataSources?.length) lines.push(`- **${a.name}:** ${a.dataSources.join('; ')}`);
    }
    lines.push('');
  }

  lines.push(`## ${s.adm}`);
  const admActivities = relevant.filter((a) => a.admStatement);
  if (admActivities.length) {
    for (const a of admActivities) lines.push(`- **${a.name}:** ${a.admStatement}`);
  } else {
    lines.push(s.noAdm);
  }
  lines.push('');

  return lines.join('\n');
}
