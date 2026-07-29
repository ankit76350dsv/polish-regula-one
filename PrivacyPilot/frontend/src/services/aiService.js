// AI Assistant — MOCK implementation.
//
// Every function here fakes what the real backend AI proxy will do later
// (an EU-region LLM endpoint called server-side; never from the browser).
// The responses are deterministic keyword heuristics so the demo behaves
// predictably. The function signatures ARE the backend contract.
//
// Compliance rules baked into this design (EU AI Act Art. 50 transparency,
// GDPR Art. 5(2) accountability):
//  1. Output is always a DRAFT — the UI labels it and a human must apply it.
//  2. Every draft request writes an AI_DRAFT audit entry (who asked, for what).
//  3. AI can draft PROSE, never verdicts — the DPIA verdict stays rule-based.
//  4. The per-tenant toggle in Settings can switch all of this off.

import { apiMutate } from './api';
import { suggestCriteria } from '../lib/dpiaCriteria';

const AI_LATENCY_MS = 900;
const delay = () => new Promise((r) => setTimeout(r, AI_LATENCY_MS));

/** Audit every AI draft request. `action` is the RBAC permission that gates
 *  the underlying feature (a role that can't edit DPIAs can't AI-draft them). */
function logDraft(actor, action, entityType, entityId, entityLabel, feature) {
  return apiMutate({
    actor,
    action,
    audit: {
      action: 'AI_DRAFT', entityType, entityId, entityLabel,
      oldValue: null, newValue: { feature, model: 'mock-ai-v0 (dummy)' },
    },
    mutator: () => null, // logs only — an AI draft never mutates records itself
  });
}

const has = (text, ...words) => words.some((w) => text.includes(w));

/** Plain-language description → suggested Art. 30 fields for the wizard. */
async function generateActivityDraft(text) {
  const q = text.toLowerCase();
  const draft = {
    dataSubjects: [], dataCategories: [], recipients: [],
    department: 'operations', lawfulBasis: '', legitimateInterestDetail: '',
    art9Condition: '', retentionPeriod: '', retentionBasis: '',
    toms: ['tom_access_control', 'tom_logging'],
    rationaleEn: [], rationalePl: [],
  };
  const say = (en, pl) => { draft.rationaleEn.push(en); draft.rationalePl.push(pl); };

  if (has(q, 'rekrut', 'recruit', 'kandydat', 'cv')) {
    Object.assign(draft, { department: 'hr', lawfulBasis: 'legal_obligation' });
    draft.dataSubjects.push('candidates');
    draft.dataCategories.push('identity', 'contact', 'employment');
    draft.retentionPeriod = 'Until the recruitment ends; 12 months with consent for future processes';
    draft.retentionBasis = 'Art. 22(1) Kodeksu pracy';
    say('Recruitment detected → Art. 22(1) Labour Code basis, candidate data categories.',
        'Wykryto rekrutację → podstawa z art. 22(1) KP, kategorie danych kandydatów.');
  }
  if (has(q, 'płac', 'plac', 'payroll', 'wynagrodz', 'kadr', 'zus')) {
    Object.assign(draft, { department: 'hr', lawfulBasis: 'legal_obligation' });
    draft.dataSubjects.push('employees');
    draft.dataCategories.push('identity', 'contact', 'financial', 'employment');
    draft.recipients.push('public_authorities', 'banks');
    draft.retentionPeriod = '10 years after employment ends';
    draft.retentionBasis = 'Art. 94 pkt 9b Kodeksu pracy';
    say('Payroll detected → statutory basis, ZUS/US as recipients, 10-year retention.',
        'Wykryto płace → obowiązek prawny, ZUS/US jako odbiorcy, retencja 10 lat.');
  }
  if (has(q, 'monitoring', 'cctv', 'kamer', 'wizyjn')) {
    Object.assign(draft, { department: 'security', lawfulBasis: 'legitimate_interest' });
    draft.legitimateInterestDetail = 'Safety of persons and protection of property on company premises.';
    draft.dataSubjects.push('employees', 'visitors');
    draft.dataCategories.push('image_cctv');
    draft.retentionPeriod = 'Maximum 3 months from recording';
    draft.retentionBasis = 'Art. 22(2) par. 3 Kodeksu pracy';
    say('CCTV detected → legitimate interest, max 3-month retention (Labour Code Art. 22(2) §3).',
        'Wykryto monitoring → uzasadniony interes, retencja maks. 3 miesiące (art. 22(2) §3 KP).');
  }
  if (has(q, 'newsletter', 'marketing', 'mailing')) {
    Object.assign(draft, { department: 'marketing', lawfulBasis: 'consent' });
    draft.dataSubjects.push('customers', 'website_users');
    draft.dataCategories.push('contact', 'online_identifiers');
    draft.recipients.push('it_providers');
    draft.retentionPeriod = 'Until consent is withdrawn';
    draft.retentionBasis = 'Art. 6(1)(a); Art. 7(3) withdrawal';
    say('Marketing detected → consent basis with withdrawal-based retention.',
        'Wykryto marketing → podstawa: zgoda, retencja do wycofania zgody.');
  }
  if (has(q, 'gps', 'lokaliz', 'location', 'flot', 'fleet')) {
    Object.assign(draft, { department: 'operations', lawfulBasis: 'legitimate_interest' });
    draft.legitimateInterestDetail = 'Route optimisation and fleet cost control.';
    draft.dataSubjects.push('employees');
    draft.dataCategories.push('location', 'identity');
    draft.retentionPeriod = '12 months';
    say('Location tracking detected → this is on the UODO DPIA list (pkt 12).',
        'Wykryto dane lokalizacyjne → pozycja z wykazu UODO (pkt 12).');
  }
  if (has(q, 'zdrow', 'health', 'medyc', 'lekar', 'pacjent')) {
    draft.dataCategories.push('health');
    draft.art9Condition = 'h';
    draft.dataSubjects.push('patients');
    say('Health data detected → Art. 9(2) condition required; suggested 9(2)(h).',
        'Wykryto dane o zdrowiu → wymagany warunek z art. 9(2); zasugerowano 9(2)(h).');
  }

  // Nothing matched → generic customer-data skeleton, clearly flagged.
  if (draft.dataSubjects.length === 0) {
    draft.dataSubjects.push('customers');
    draft.dataCategories.push('identity', 'contact');
    draft.lawfulBasis = 'contract';
    say('No specific pattern recognised — generic contract-based skeleton; review every field.',
        'Nie rozpoznano wzorca — ogólny szkielet (umowa); zweryfikuj każde pole.');
  }

  draft.dataSubjects = [...new Set(draft.dataSubjects)];
  draft.dataCategories = [...new Set(draft.dataCategories)];
  draft.recipients = [...new Set(draft.recipients)];
  // DPIA criteria come from the SAME rule engine as the wizard — AI never
  // invents screening verdicts.
  draft.dpiaCriteria = suggestCriteria(draft);
  draft.name = text.split(/\s+/).slice(0, 6).join(' ');
  draft.purpose = text.trim();
  return draft;
}

export const aiService = {
  /** Wizard copilot: description → field draft. */
  draftActivity: async (actor, text) => {
    await delay();
    await logDraft(actor, 'CREATE_ACTIVITY', 'activity', null, text.slice(0, 60), 'wizard_copilot');
    return generateActivityDraft(text);
  },

  /** DPIA prose sections (Art. 35(7)(a)/(b)/(d)). Fills the editor; human saves. */
  draftDpiaSection: async (actor, dpia, activity, section) => {
    await delay();
    await logDraft(actor, 'MANAGE_DPIA', 'dpia', dpia.id, dpia.title, `dpia_${section}`);
    const name = activity?.name ?? dpia.title;
    const subjects = activity?.dataSubjects?.join(', ') || 'data subjects';
    const retention = activity?.retentionPeriod || 'the documented retention period';
    if (section === 'description') {
      return `Processing operation: ${name}. Purpose: ${activity?.purpose ?? '—'}. `
        + `Data subjects: ${subjects}. Data categories: ${activity?.dataCategories?.join(', ') ?? '—'}. `
        + `Retention: ${retention}. Systems and access paths to be confirmed by the process owner. `
        + `Screening criteria matched (UODO list, M.P. 2019 poz. 666): ${dpia.criteriaMatched.join(', ')}.`;
    }
    if (section === 'necessity') {
      return `Necessity: the purpose cannot reasonably be achieved with less data or anonymised data because the operation requires identifying ${subjects}. `
        + `Proportionality: scope is limited to the listed categories; retention is bounded (${retention}); access is role-restricted. `
        + `Less intrusive alternatives considered: [describe alternatives and why they were rejected]. `
        + `Data minimisation actions applied: [list].`;
    }
    if (section === 'measures') {
      return ['Role-based access limited to named staff', 'Encryption at rest and in transit',
        'Automatic retention enforcement and deletion job', 'Staff training on this specific operation',
        'Periodic review of the assessment (Art. 35(11))'].join('\n');
    }
    return '';
  },

  /** Suggested risk entries for the Art. 35(7)(c) matrix — user reviews/deletes. */
  suggestRisks: async (actor, dpia) => {
    await delay();
    await logDraft(actor, 'MANAGE_DPIA', 'dpia', dpia.id, dpia.title, 'dpia_risks');
    const bank = {
      systematic_monitoring: { description: 'Monitoring extends beyond the declared zones or purposes', likelihood: 3, severity: 4, mitigation: 'Zone review, purpose-limitation policy, signage audit', residualLikelihood: 2, residualSeverity: 3 },
      location_tracking: { description: 'Tracking continues outside working hours', likelihood: 4, severity: 4, mitigation: 'Automatic shift-based tracking cut-off', residualLikelihood: 2, residualSeverity: 3 },
      special_categories: { description: 'Unauthorised access to special-category data', likelihood: 2, severity: 5, mitigation: 'Separate encryption, need-to-know access, access logging', residualLikelihood: 1, residualSeverity: 4 },
      vulnerable_subjects: { description: 'Power imbalance pressures data subjects (employees/patients)', likelihood: 3, severity: 4, mitigation: 'Transparent policy, no covert processing, complaint channel', residualLikelihood: 2, residualSeverity: 3 },
      large_scale: { description: 'Breach impact amplified by data volume', likelihood: 2, severity: 5, mitigation: 'Segmentation, backup isolation, incident runbook', residualLikelihood: 1, residualSeverity: 4 },
    };
    const picks = dpia.criteriaMatched.filter((c) => bank[c]).map((c) => bank[c]);
    if (picks.length === 0) {
      picks.push({ description: 'Unauthorised access to personal data', likelihood: 2, severity: 4, mitigation: 'RBAC, encryption, access logging', residualLikelihood: 1, residualSeverity: 3 });
    }
    return picks.map((r, i) => ({ ...r, id: `r-ai-${Date.now()}-${i}` }));
  },

  /** Draft Art. 33(3) UODO notification content from the breach record. */
  draftBreachNotification: async (actor, breach, lang) => {
    await delay();
    await logDraft(actor, 'MANAGE_BREACHES', 'breach', breach.id, breach.title, 'breach_art33');
    const pl = lang === 'pl';
    const L = pl
      ? ['ZGŁOSZENIE NARUSZENIA OCHRONY DANYCH OSOBOWYCH — projekt (art. 33(3) RODO)',
         'a) Charakter naruszenia', 'Kategorie i przybliżona liczba osób', 'Kategorie danych',
         'b) Dane kontaktowe IOD', '[uzupełnij z Ustawień]',
         'c) Możliwe konsekwencje naruszenia',
         'd) Zastosowane i proponowane środki zaradcze',
         'Ocena ryzyka i uzasadnienie']
      : ['PERSONAL DATA BREACH NOTIFICATION — draft (Art. 33(3) GDPR)',
         'a) Nature of the breach', 'Categories and approximate number of data subjects', 'Data categories',
         'b) DPO contact details', '[fill from Settings]',
         'c) Likely consequences of the breach',
         'd) Measures taken or proposed',
         'Risk assessment and rationale'];
    const measures = (breach.remediation ?? []).map((r) => `- ${r.text}${r.done ? ' [done]' : ''}`).join('\n') || '- [describe]';
    return `# ${L[0]}\n\n## ${L[1]}\n${breach.description}\n\n**${L[2]}:** ${breach.subjectsCount}\n**${L[3]}:** ${(breach.dataCategories ?? []).join(', ') || '—'}\n\n## ${L[4]}\n${L[5]}\n\n## ${L[6]}\n[${pl ? 'opisz możliwe skutki dla osób' : 'describe likely effects on individuals'}]\n\n## ${L[7]}\n${measures}\n\n## ${L[8]}\n${breach.riskRationale}\n`;
  },

  /** Draft a DSAR response letter for the request type. */
  draftDsarReply: async (actor, dsar, lang) => {
    await delay();
    await logDraft(actor, 'MANAGE_DSAR', 'dsar', dsar.id, `${dsar.type} — ${dsar.requesterName}`, 'dsar_reply');
    const pl = lang === 'pl';
    const bodies = {
      access: pl
        ? 'W odpowiedzi na Pani/Pana wniosek o dostęp do danych (art. 15 RODO) przekazujemy w załączeniu kopię danych osobowych wraz z informacjami o celach, kategoriach, odbiorcach i okresie przechowywania.'
        : 'In response to your access request (Art. 15 GDPR), please find enclosed a copy of your personal data together with information on purposes, categories, recipients and retention.',
      erasure: pl
        ? 'W odpowiedzi na wniosek o usunięcie danych (art. 17 RODO) informujemy, że dane zostały usunięte z naszych systemów, z wyjątkiem danych, których dalsze przechowywanie jest wymagane przepisami prawa — [wskaż podstawę].'
        : 'In response to your erasure request (Art. 17 GDPR), your data has been deleted from our systems, except where retention is required by law — [state the basis].',
      rectification: pl
        ? 'Zgodnie z wnioskiem (art. 16 RODO) sprostowaliśmy Pani/Pana dane. Poinformowaliśmy również odbiorców danych zgodnie z art. 19.'
        : 'As requested (Art. 16 GDPR), your data has been rectified. Recipients have been informed per Art. 19.',
      restriction: pl
        ? 'Zgodnie z wnioskiem (art. 18 RODO) ograniczyliśmy przetwarzanie Pani/Pana danych do czasu [wskaż zakres].'
        : 'As requested (Art. 18 GDPR), processing of your data has been restricted pending [state the scope].',
      portability: pl
        ? 'W odpowiedzi na wniosek o przenoszenie danych (art. 20 RODO) przekazujemy dane w ustrukturyzowanym formacie nadającym się do odczytu maszynowego (JSON/CSV).'
        : 'In response to your portability request (Art. 20 GDPR), your data is provided in a structured, machine-readable format (JSON/CSV).',
      objection: pl
        ? 'W odpowiedzi na sprzeciw (art. 21 RODO) informujemy, że zaprzestaliśmy przetwarzania Pani/Pana danych w celu [cel], chyba że wykażemy nadrzędne prawnie uzasadnione podstawy — [ocena].'
        : 'In response to your objection (Art. 21 GDPR), we have ceased processing your data for [purpose], unless compelling legitimate grounds are demonstrated — [assessment].',
    };
    const head = pl ? `Szanowna Pani / Szanowny Panie ${dsar.requesterName},` : `Dear ${dsar.requesterName},`;
    const foot = pl
      ? 'Przysługuje Pani/Panu prawo wniesienia skargi do Prezesa UODO (ul. Stawki 2, 00-193 Warszawa).\n\nZ poważaniem,\n[imię i nazwisko, funkcja]'
      : 'You have the right to lodge a complaint with the President of UODO (ul. Stawki 2, 00-193 Warszawa).\n\nKind regards,\n[name, role]';
    return `${head}\n\n${bodies[dsar.type] ?? bodies.access}\n\n${foot}`;
  },
};
