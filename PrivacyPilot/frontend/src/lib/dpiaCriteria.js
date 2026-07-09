// DPIA screening engine — the 12 processing types from the Polish mandatory
// DPIA list: Komunikat Prezesa UODO z 17 czerwca 2019 r. (M.P. 2019 poz. 666),
// issued under Art. 35(4) GDPR, built on the EDPB WP248 criteria.
//
// Official rule (annex preamble, verbatim sense): "as a rule, processing meeting
// at least TWO of the criteria will require a DPIA — in some cases ONE may
// suffice". We word the verdicts exactly that way: it's a strong presumption,
// not a hard statutory threshold. (Frontend B overstated it as "legally
// required minimum 2"; that wording is wrong and is not used here.)

// Single source of truth for which data categories are Art. 9 special categories.
import { SPECIAL_CATEGORY_IDS } from './gdpr';

export const DPIA_CRITERIA = [
  {
    id: 'evaluation_scoring', ref: 'M.P. 2019 poz. 666, pkt 1',
    en: 'Evaluation or scoring, including profiling and predicting',
    pl: 'Ocena lub punktacja, w tym profilowanie i przewidywanie',
    exampleEn: 'Marketing profiling, AI credit scoring, insurance premium optimisation',
    examplePl: 'Profilowanie marketingowe, scoring kredytowy AI, optymalizacja składek',
  },
  {
    id: 'automated_decisions', ref: 'M.P. 2019 poz. 666, pkt 2',
    en: 'Automated decision-making with legal or similarly significant effect',
    pl: 'Zautomatyzowane podejmowanie decyzji o skutku prawnym lub podobnym',
    exampleEn: 'Automated pricing based on profiles, automated loan refusal',
    examplePl: 'Automatyczne ustalanie cen na podstawie profilu, automatyczna odmowa kredytu',
  },
  {
    id: 'systematic_monitoring', ref: 'M.P. 2019 poz. 666, pkt 3',
    en: 'Systematic large-scale monitoring of publicly accessible places or of employees',
    pl: 'Systematyczne monitorowanie na dużą skalę miejsc publicznych lub pracowników',
    exampleEn: 'Employee e-mail/software monitoring, working-time systems, smart CCTV',
    examplePl: 'Monitoring poczty i aktywności pracowników, systemy czasu pracy, inteligentny CCTV',
  },
  {
    id: 'special_categories', ref: 'M.P. 2019 poz. 666, pkt 4',
    en: 'Special categories (Art. 9) or criminal data (Art. 10)',
    pl: 'Szczególne kategorie danych (art. 9) lub dane o wyrokach (art. 10)',
    exampleEn: 'Health/clinical data, political preferences, personal cloud data',
    examplePl: 'Dane o zdrowiu, preferencje polityczne, dane z chmur osobistych',
  },
  {
    id: 'biometric', ref: 'M.P. 2019 poz. 666, pkt 5',
    en: 'Biometric data solely to identify a person or control access',
    pl: 'Dane biometryczne wyłącznie w celu identyfikacji lub kontroli dostępu',
    exampleEn: 'Fingerprint entry systems, face recognition login',
    examplePl: 'Wejście na odcisk palca, logowanie rozpoznawaniem twarzy',
  },
  {
    id: 'genetic', ref: 'M.P. 2019 poz. 666, pkt 6',
    en: 'Genetic data',
    pl: 'Dane genetyczne',
    exampleEn: 'DNA diagnostics and tests',
    examplePl: 'Diagnostyka i testy DNA',
  },
  {
    id: 'large_scale', ref: 'M.P. 2019 poz. 666, pkt 7',
    en: 'Large-scale processing (subjects, volume, duration, geography)',
    pl: 'Przetwarzanie na dużą skalę (liczba osób, zakres, czas, zasięg)',
    exampleEn: 'Nationwide customer databases, long retention, wide geography',
    examplePl: 'Ogólnokrajowe bazy klientów, długa retencja, szeroki zasięg',
  },
  {
    id: 'matching_combining', ref: 'M.P. 2019 poz. 666, pkt 8',
    en: 'Matching or combining datasets from different sources',
    pl: 'Łączenie lub porównywanie zbiorów danych z różnych źródeł',
    exampleEn: 'Combining CRM with external behavioural data',
    examplePl: 'Łączenie CRM z zewnętrznymi danymi behawioralnymi',
  },
  {
    id: 'vulnerable_subjects', ref: 'M.P. 2019 poz. 666, pkt 9',
    en: 'Data of vulnerable/dependent persons (employees, children, patients) — incl. whistleblowing systems',
    pl: 'Dane osób zależnych (pracownicy, dzieci, pacjenci) — w tym systemy sygnalistów',
    exampleEn: 'Whistleblowing hotlines, employee evaluation systems',
    examplePl: 'Systemy zgłaszania nieprawidłowości, systemy ocen pracowniczych',
  },
  {
    id: 'innovative_tech', ref: 'M.P. 2019 poz. 666, pkt 10',
    en: 'Innovative technological or organisational solutions',
    pl: 'Innowacyjne rozwiązania technologiczne lub organizacyjne',
    exampleEn: 'IoT, wearables, drones, telemedicine, smart metering',
    examplePl: 'IoT, urządzenia noszone, drony, telemedycyna, inteligentne liczniki',
  },
  {
    id: 'blocks_rights', ref: 'M.P. 2019 poz. 666, pkt 11',
    en: 'Processing that itself prevents exercising rights or using a service/contract',
    pl: 'Przetwarzanie uniemożliwiające wykonanie prawa lub skorzystanie z usługi/umowy',
    exampleEn: 'Credit refusals based on debtor databases',
    examplePl: 'Odmowa kredytu na podstawie baz dłużników',
  },
  {
    id: 'location_tracking', ref: 'M.P. 2019 poz. 666, pkt 12',
    en: 'Processing of location data (incl. employee location tracking)',
    pl: 'Przetwarzanie danych lokalizacyjnych (w tym lokalizacja pracowników)',
    exampleEn: 'Fleet GPS, mobile workforce tracking, remote-work monitoring',
    examplePl: 'GPS floty, śledzenie pracowników mobilnych, monitoring pracy zdalnej',
  },
];

// Art. 35(3) GDPR lists processing for which a DPIA is ALWAYS mandatory —
// it does not depend on how many UODO criteria are matched. We map those three
// statutory cases onto our criteria so a single one of them forces "required":
//  - 35(3)(a): automated evaluation/decisions with legal or similar effect
//  - 35(3)(b): large-scale processing of special (Art. 9) or criminal (Art. 10) data
//  - 35(3)(c): large-scale systematic monitoring of a publicly accessible area
// This fixes the old count-only logic, which could call a legally-mandatory DPIA
// merely "recommended" (e.g. a single large-scale monitoring criterion → count 1).
export function isArt353Mandatory(matchedIds) {
  const ids = matchedIds ?? [];
  const has = (x) => ids.includes(x);
  if (has('automated_decisions')) return true;                    // Art. 35(3)(a)
  if (has('systematic_monitoring')) return true;                  // Art. 35(3)(c)
  if (has('special_categories') && has('large_scale')) return true; // Art. 35(3)(b)
  if (has('biometric') && has('large_scale')) return true;        // Art. 9 biometrics at scale
  return false;
}

/**
 * Screen an activity against the UODO list.
 * Returns a verdict the UI can show, with the honest legal wording.
 *  - Art. 35(3) case → 'required'  (statutory — mandatory regardless of count)
 *  - 2+ criteria     → 'required'  (as a rule a DPIA is required)
 *  - 1 criterion     → 'recommended' (one may suffice — assess and document)
 *  - 0 criteria      → 'not_indicated'
 */
export function evaluateDpia(matchedIds) {
  const count = matchedIds?.length ?? 0;
  if (isArt353Mandatory(matchedIds)) {
    return {
      verdict: 'required', count, art353: true,
      en: 'This processing falls under Art. 35(3) GDPR — a DPIA is mandatory before processing begins, regardless of how many UODO criteria are matched.',
      pl: 'To przetwarzanie jest objęte art. 35(3) RODO — DPIA jest obowiązkowa przed rozpoczęciem przetwarzania, niezależnie od liczby spełnionych kryteriów z wykazu UODO.',
    };
  }
  if (count >= 2) {
    return {
      verdict: 'required', count,
      en: 'As a rule, meeting two or more criteria from the UODO list (M.P. 2019 poz. 666) requires a DPIA before processing starts (Art. 35(1)).',
      pl: 'Co do zasady spełnienie dwóch lub więcej kryteriów z wykazu UODO (M.P. 2019 poz. 666) wymaga przeprowadzenia DPIA przed rozpoczęciem przetwarzania (art. 35(1)).',
    };
  }
  if (count === 1) {
    return {
      verdict: 'recommended', count,
      en: 'One criterion is met. In some cases a single criterion suffices — assess the risk and document your decision either way (Art. 5(2) accountability).',
      pl: 'Spełniono jedno kryterium. W niektórych przypadkach wystarczy jedno — oceń ryzyko i udokumentuj decyzję (zasada rozliczalności, art. 5(2)).',
    };
  }
  return {
    verdict: 'not_indicated', count,
    en: 'No criteria from the UODO list are met. A DPIA is not indicated, but re-screen when the processing changes (Art. 35(11)).',
    pl: 'Nie spełniono żadnego kryterium z wykazu UODO. DPIA nie jest wskazana, ale powtórz analizę przy zmianie przetwarzania (art. 35(11)).',
  };
}

/**
 * Suggest criteria automatically from what the wizard already knows,
 * so the screening step starts pre-filled instead of empty.
 * The user can always adjust — automation assists, it does not decide.
 */
export function suggestCriteria({ dataCategories = [], dataSubjects = [] }) {
  const suggested = new Set();
  const has = (id) => dataCategories.includes(id);

  // Any Art. 9 special category, or Art. 10 criminal data, triggers the
  // special-categories criterion. Derived from the single source of truth so it
  // stays correct when new special categories are added to DATA_CATEGORIES.
  if (SPECIAL_CATEGORY_IDS.some((id) => has(id)) || has('criminal')) {
    suggested.add('special_categories');
  }
  if (has('biometric_id')) suggested.add('biometric');
  if (has('genetic')) suggested.add('genetic');
  if (has('location')) suggested.add('location_tracking');
  if (has('image_cctv')) suggested.add('systematic_monitoring');
  // Children are the paradigm vulnerable subject (WP248). Children's data is a
  // data CATEGORY here (Art. 8), not a subject type — so check the categories too;
  // the old code only checked a non-existent 'children' subject and missed them.
  if (has('children')) suggested.add('vulnerable_subjects');
  // Candidates count too: WP248 treats anyone in a power-imbalance relation
  // with the controller (employees, applicants, patients) as vulnerable.
  if (dataSubjects.includes('employees') || dataSubjects.includes('candidates') ||
      dataSubjects.includes('patients') || dataSubjects.includes('whistleblowers')) {
    suggested.add('vulnerable_subjects');
  }
  return [...suggested];
}
