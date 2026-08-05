/**
 * Turns the dashboard API's machine codes into words a person can read.
 *
 * WHY THE SERVER SENDS CODES INSTEAD OF SENTENCES:
 *   The API returns keys like "ksef.invoices.deadlineBreached" and never
 *   pre-written text. That is what makes the same response usable in Polish and in
 *   English — the wording lives here, in the browser, and the server stays a
 *   source of facts. It also means a wording change never needs a backend release.
 *
 * POLISH IS THE PRIMARY MARKET, so every label has a Polish form. The active
 * language is taken from a saved preference, falling back to the browser's own
 * setting; anything that is not Polish falls back to English.
 *
 * A key with no entry falls back to the key itself rather than to an empty string,
 * so a newly added metric shows up visibly instead of silently disappearing.
 */

const LANGUAGE_STORAGE_KEY = 'regulaone.language';

/** 'pl' or 'en'. */
export function activeLanguage() {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'pl' || saved === 'en') return saved;
  } catch {
    // Private browsing can block localStorage — fall through to the browser setting.
  }
  const browser = (window.navigator?.language ?? 'en').toLowerCase();
  return browser.startsWith('pl') ? 'pl' : 'en';
}

// ── Module names ─────────────────────────────────────────────────────────────

export const MODULE_LABELS = {
  KSEFFLOW: { en: 'KSeFFlow — e-invoicing', pl: 'KSeFFlow — e-faktury' },
  WORKPULSE: { en: 'WorkPulse — working time', pl: 'WorkPulse — czas pracy' },
  SAFEWORK: { en: 'SafeWork — health & safety', pl: 'SafeWork — BHP i badania' },
  SAFEVOICE: { en: 'SafeVoice — whistleblowing', pl: 'SafeVoice — sygnaliści' },
  WASTESYNC: { en: 'WasteSync — BDO reporting', pl: 'WasteSync — sprawozdania BDO' },
  PRIVACYPILOT: { en: 'PrivacyPilot — GDPR', pl: 'PrivacyPilot — RODO' },
};

// ── Why a module card has no numbers ─────────────────────────────────────────

export const CARD_STATUS_LABELS = {
  NOT_IN_PLAN: {
    en: 'Not included in your plan',
    pl: 'Nieobjęte Twoim planem',
  },
  NO_ACCESS: {
    en: 'You have not been given access to this module',
    pl: 'Nie masz nadanego dostępu do tego modułu',
  },
  RESTRICTED: {
    en: 'Restricted — a SafeVoice role is required to see these figures',
    pl: 'Ograniczone — do wglądu wymagana rola w SafeVoice',
  },
  UNAVAILABLE: {
    en: 'Figures could not be read right now',
    pl: 'Nie udało się teraz odczytać danych',
  },
};

// ── Metric labels ────────────────────────────────────────────────────────────
//
// Grouped per module in the same order the cards show them.

export const METRIC_LABELS = {
  // KSeFFlow
  'ksef.invoices.total': { en: 'Invoices total', pl: 'Faktury łącznie' },
  'ksef.invoices.issuedThisMonth': { en: 'Issued this month', pl: 'Wystawione w tym miesiącu' },
  'ksef.invoices.draft': { en: 'Drafts', pl: 'Wersje robocze' },
  'ksef.invoices.pending': { en: 'Awaiting KSeF', pl: 'Oczekują na KSeF' },
  'ksef.invoices.sent': { en: 'Accepted by KSeF', pl: 'Przyjęte przez KSeF' },
  'ksef.invoices.failed': { en: 'Rejected by KSeF', pl: 'Odrzucone przez KSeF' },
  'ksef.invoices.offlineQueued': { en: 'Queued offline', pl: 'W kolejce offline' },
  'ksef.invoices.deadlineBreached': { en: 'Past KSeF deadline', pl: 'Po terminie przesłania' },
  'ksef.invoices.acceptanceRate': { en: 'Acceptance rate', pl: 'Skuteczność przesłań' },
  'ksef.upo.missing': { en: 'Accepted without stored UPO', pl: 'Przyjęte bez zapisanego UPO' },
  'ksef.certificates.active': { en: 'Certificates in use', pl: 'Certyfikaty w użyciu' },
  'ksef.certificates.expiringSoon': { en: 'Certificates expiring (30 d)', pl: 'Certyfikaty wygasają (30 dni)' },
  'ksef.certificates.expired': { en: 'Certificates expired', pl: 'Certyfikaty wygasłe' },
  'ksef.certificates.nearestExpiry': { en: 'Next certificate expiry', pl: 'Najbliższe wygaśnięcie' },
  'ksef.certificates.authenticationReady': { en: 'Can authenticate to KSeF', pl: 'Możliwe logowanie do KSeF' },

  // WorkPulse
  'workpulse.today.clockedIn': { en: 'Clocked in now', pl: 'Aktualnie w pracy' },
  'workpulse.today.onBreak': { en: 'On a break now', pl: 'Aktualnie na przerwie' },
  'workpulse.today.completed': { en: 'Shifts finished today', pl: 'Zmiany zakończone dziś' },
  'workpulse.window.missingClockOut': { en: 'Shifts with no clock-out (30 d)', pl: 'Zmiany bez wyjścia (30 dni)' },
  'workpulse.approvals.overtimePending': { en: 'Overtime awaiting approval', pl: 'Nadgodziny do zatwierdzenia' },
  'workpulse.approvals.absencesPending': { en: 'Absence requests awaiting a decision', pl: 'Wnioski o nieobecność do decyzji' },
  'workpulse.window.workedHours': { en: 'Hours worked (30 d)', pl: 'Godziny przepracowane (30 dni)' },
  'workpulse.window.overtimeHours': { en: 'Overtime hours (30 d)', pl: 'Godziny nadliczbowe (30 dni)' },
  'workpulse.window.missingBreak': { en: 'Shifts with no break', pl: 'Zmiany bez przerwy' },
  'workpulse.window.shortBreak': { en: 'Shifts with too short a break', pl: 'Zmiany ze zbyt krótką przerwą' },
  'workpulse.window.dailyRestViolations': { en: 'Daily rest below 11 h', pl: 'Odpoczynek dobowy poniżej 11 h' },
  'workpulse.window.weeklyRestViolations': { en: 'Weekly rest below 35 h', pl: 'Odpoczynek tygodniowy poniżej 35 h' },
  'workpulse.window.nightShifts': { en: 'Night shifts (30 d)', pl: 'Zmiany nocne (30 dni)' },
  'workpulse.window.sundayHolidayShifts': { en: 'Sunday / holiday shifts (30 d)', pl: 'Zmiany w niedziele i święta (30 dni)' },
  'workpulse.window.protectedWorkFlagged': { en: 'Protected employees flagged', pl: 'Sygnały u pracowników chronionych' },
  'workpulse.window.locationFlagged': { en: 'Clock-ins with a location warning', pl: 'Wejścia z ostrzeżeniem lokalizacji' },
  'workpulse.settlement.overWeeklyAverageCap': { en: 'Employees above the 48 h average', pl: 'Pracownicy powyżej średnio 48 h' },
  'workpulse.settlement.overAnnualOvertimeLimit': { en: 'Employees above 150 overtime h', pl: 'Pracownicy powyżej 150 h nadliczbowych' },
  'workpulse.settlement.approachingAnnualOvertimeLimit': { en: 'Employees nearing the yearly limit', pl: 'Pracownicy blisko limitu rocznego' },
  'workpulse.monitoring.acknowledgements': { en: 'Monitoring notices acknowledged', pl: 'Potwierdzenia informacji o monitoringu' },

  // SafeWork
  'safework.employees.total': { en: 'Employee profiles', pl: 'Profile pracowników' },
  'safework.employees.compliant': { en: 'Fully compliant', pl: 'W pełni zgodni' },
  'safework.employees.compliantPct': { en: 'Compliant share', pl: 'Udział zgodnych' },
  'safework.employees.blocked': { en: 'Blocked from clocking in', pl: 'Zablokowani przed wejściem' },
  'safework.documents.medicalExpired': { en: 'Medical certificates expired', pl: 'Badania lekarskie wygasłe' },
  'safework.documents.bhpExpired': { en: 'BHP training expired', pl: 'Szkolenia BHP wygasłe' },
  'safework.documents.missingRequired': { en: 'Required documents never uploaded', pl: 'Wymagane dokumenty niedostarczone' },
  'safework.documents.expiringSoon': { en: 'Documents expiring (30 d)', pl: 'Dokumenty wygasają (30 dni)' },

  // SafeVoice
  'safevoice.cases.open': { en: 'Open reports', pl: 'Zgłoszenia otwarte' },
  'safevoice.cases.acknowledgementOverdue': { en: 'Receipt not confirmed within 7 days', pl: 'Brak potwierdzenia w 7 dni' },
  'safevoice.cases.feedbackOverdue': { en: 'Feedback past 3 months', pl: 'Informacja zwrotna po 3 miesiącach' },
  'safevoice.cases.feedbackDueSoon': { en: 'Feedback due within 14 days', pl: 'Informacja zwrotna w ciągu 14 dni' },
  'safevoice.cases.unassigned': { en: 'Reports with no handler', pl: 'Zgłoszenia bez prowadzącego' },
  'safevoice.messages.unreadByStaff': { en: 'Unread reporter messages', pl: 'Nieprzeczytane wiadomości zgłaszających' },
  'safevoice.cases.withinSlaPct': { en: 'Inside the legal deadline', pl: 'W terminie ustawowym' },
  'safevoice.audit.entries': { en: 'Sealed audit entries', pl: 'Zapisy w rejestrze audytu' },

  // WasteSync
  'wastesync.companies.active': { en: 'Reporting entities', pl: 'Podmioty sprawozdawcze' },
  'wastesync.companies.missingBdoNumber': { en: 'Entities with no BDO number', pl: 'Podmioty bez numeru BDO' },
  'wastesync.entries.thisYear': { en: 'Monthly records this year', pl: 'Wpisy miesięczne w tym roku' },
  'wastesync.totals.thisYearKg': { en: 'Waste recorded this year', pl: 'Odpady zaewidencjonowane w tym roku' },
  'wastesync.entries.missingMonths': { en: 'Finished months with no data', pl: 'Zakończone miesiące bez danych' },
  'wastesync.report.reportingYear': { en: 'Reporting year', pl: 'Rok sprawozdawczy' },
  'wastesync.report.deadline': { en: 'Filing deadline', pl: 'Termin złożenia' },
  'wastesync.report.submitted': { en: 'Entities that filed', pl: 'Podmioty, które złożyły' },
  'wastesync.report.generatedNotSubmitted': { en: 'Reports generated but not filed', pl: 'Sprawozdania wygenerowane, niezłożone' },
  'wastesync.report.notSubmitted': { en: 'Entities that have not filed', pl: 'Podmioty, które nie złożyły' },
  'wastesync.report.thresholdBreaches': { en: 'Threshold breaches found', pl: 'Przekroczenia progów' },

  // PrivacyPilot
  'privacypilot.ropa.activities': { en: 'Processing activities on record', pl: 'Czynności przetwarzania w rejestrze' },
  'privacypilot.ropa.reviewOverdue': { en: 'Activities past their review date', pl: 'Czynności po terminie przeglądu' },
  'privacypilot.dpia.required': { en: 'DPIAs required but not started', pl: 'Wymagane DPIA nierozpoczęte' },
  'privacypilot.dpia.inProgress': { en: 'DPIAs in progress', pl: 'DPIA w toku' },
  'privacypilot.dpia.priorConsultationPending': { en: 'Prior consultations outstanding', pl: 'Zaległe uprzednie konsultacje' },
  'privacypilot.breaches.open': { en: 'Open breaches', pl: 'Otwarte naruszenia' },
  'privacypilot.breaches.uodoWindowOpen': { en: 'Inside the 72 h UODO window', pl: 'W 72-godzinnym oknie UODO' },
  'privacypilot.breaches.uodoOverdue': { en: 'Past the 72 h UODO deadline', pl: 'Po terminie 72 h do UODO' },
  'privacypilot.breaches.subjectsNotificationPending': { en: 'People still to be notified', pl: 'Osoby jeszcze niezawiadomione' },
  'privacypilot.dsar.open': { en: 'Data-subject requests open', pl: 'Otwarte wnioski osób' },
  'privacypilot.dsar.dueSoon': { en: 'Requests due within 7 days', pl: 'Wnioski z terminem w 7 dni' },
  'privacypilot.dsar.overdue': { en: 'Requests past their deadline', pl: 'Wnioski po terminie' },
  'privacypilot.vendors.total': { en: 'Processors on record', pl: 'Podmioty przetwarzające' },
  'privacypilot.vendors.dpaMissing': { en: 'Processors with no contract', pl: 'Przetwarzający bez umowy' },
  'privacypilot.transfers.total': { en: 'Transfers outside the EEA', pl: 'Transfery poza EOG' },
  'privacypilot.transfers.withoutTia': { en: 'Transfers with no impact assessment', pl: 'Transfery bez oceny skutków' },
  'privacypilot.notices.published': { en: 'Privacy notices issued', pl: 'Wydane informacje o przetwarzaniu' },
};

// ── "Needs attention" items ──────────────────────────────────────────────────
//
// Each entry is the thing that has to be DONE, phrased as an action, because this
// list is a to-do list rather than a report.

export const ATTENTION_LABELS = {
  // KSeFFlow
  KSEF_SUBMISSION_DEADLINE_BREACHED: { en: 'Invoices past their KSeF submission deadline', pl: 'Faktury po terminie przesłania do KSeF' },
  KSEF_INVOICES_FAILED: { en: 'Invoices rejected by KSeF — correct and resend', pl: 'Faktury odrzucone przez KSeF — popraw i wyślij ponownie' },
  KSEF_OFFLINE_QUEUE: { en: 'Invoices waiting in the offline queue', pl: 'Faktury czekające w kolejce offline' },
  KSEF_UPO_MISSING: { en: 'Accepted invoices with no UPO stored', pl: 'Przyjęte faktury bez zapisanego UPO' },
  KSEF_AUTH_CERTIFICATE_MISSING: { en: 'No usable KSeF authentication certificate', pl: 'Brak działającego certyfikatu uwierzytelniającego KSeF' },
  KSEF_CERTIFICATE_EXPIRED: { en: 'KSeF certificates have expired', pl: 'Certyfikaty KSeF wygasły' },
  KSEF_CERTIFICATE_EXPIRING: { en: 'KSeF certificates expire within 30 days', pl: 'Certyfikaty KSeF wygasają w ciągu 30 dni' },

  // WorkPulse
  WORKPULSE_MISSING_BREAK: { en: 'Shifts recorded with no legally required break', pl: 'Zmiany bez wymaganej prawem przerwy' },
  WORKPULSE_DAILY_REST_VIOLATION: { en: 'Shifts with less than 11 h daily rest', pl: 'Zmiany z odpoczynkiem dobowym poniżej 11 h' },
  WORKPULSE_WEEKLY_REST_VIOLATION: { en: 'Weeks with less than 35 h continuous rest', pl: 'Tygodnie bez 35 h nieprzerwanego odpoczynku' },
  WORKPULSE_PROTECTED_WORK_FLAGGED: { en: 'Protected employees worked overtime or at night', pl: 'Pracownicy chronieni w nadgodzinach lub w nocy' },
  WORKPULSE_OVERTIME_APPROVAL_PENDING: { en: 'Overtime waiting for a manager decision', pl: 'Nadgodziny czekają na decyzję' },
  WORKPULSE_ABSENCE_APPROVAL_PENDING: { en: 'Absence requests waiting for a decision', pl: 'Wnioski o nieobecność czekają na decyzję' },
  WORKPULSE_MISSING_CLOCK_OUT: { en: 'Shifts never clocked out — records incomplete', pl: 'Zmiany bez wyjścia — ewidencja niepełna' },
  WORKPULSE_WEEKLY_AVERAGE_CAP_EXCEEDED: { en: 'Employees above the 48 h average working week', pl: 'Pracownicy powyżej przeciętnie 48 h tygodniowo' },
  WORKPULSE_ANNUAL_OVERTIME_LIMIT_EXCEEDED: { en: 'Employees above 150 overtime hours this year', pl: 'Pracownicy powyżej 150 h nadliczbowych w roku' },
  WORKPULSE_ANNUAL_OVERTIME_LIMIT_NEAR: { en: 'Employees approaching the yearly overtime limit', pl: 'Pracownicy blisko rocznego limitu nadgodzin' },
  WORKPULSE_LOCATION_FLAGGED: { en: 'Clock-ins with a location warning to review', pl: 'Wejścia z ostrzeżeniem lokalizacji do sprawdzenia' },

  // SafeWork
  SAFEWORK_EMPLOYEE_BLOCKED: { en: 'Employees blocked from working — documents invalid', pl: 'Pracownicy zablokowani — dokumenty nieważne' },
  SAFEWORK_DOCUMENT_EXPIRED: { en: 'Medical or BHP documents have expired', pl: 'Badania lub szkolenia BHP wygasły' },
  SAFEWORK_DOCUMENT_MISSING: { en: 'Required medical or BHP documents were never uploaded', pl: 'Brak wymaganych badań lub szkoleń BHP' },
  SAFEWORK_DOCUMENT_EXPIRING: { en: 'Medical or BHP documents expire within 30 days', pl: 'Badania lub szkolenia BHP wygasają w ciągu 30 dni' },

  // SafeVoice
  SAFEVOICE_ACKNOWLEDGEMENT_OVERDUE: { en: 'Reports not acknowledged within 7 days', pl: 'Zgłoszenia bez potwierdzenia w ciągu 7 dni' },
  SAFEVOICE_FEEDBACK_OVERDUE: { en: 'Reports past the 3-month feedback deadline', pl: 'Zgłoszenia po 3-miesięcznym terminie odpowiedzi' },
  SAFEVOICE_FEEDBACK_DUE_SOON: { en: 'Reports whose feedback deadline is close', pl: 'Zgłoszenia z bliskim terminem odpowiedzi' },
  SAFEVOICE_CASE_UNASSIGNED: { en: 'Reports with nobody assigned to handle them', pl: 'Zgłoszenia bez przydzielonego prowadzącego' },
  SAFEVOICE_REPORTER_WAITING: { en: 'Reporters waiting for a reply', pl: 'Zgłaszający czekają na odpowiedź' },

  // WasteSync
  WASTESYNC_BDO_NUMBER_MISSING: { en: 'Entities cannot file — BDO number missing', pl: 'Podmioty nie mogą złożyć — brak numeru BDO' },
  WASTESYNC_ANNUAL_REPORT_OVERDUE: { en: 'Yearly BDO report was not filed by 15 March', pl: 'Roczne sprawozdanie BDO niezłożone do 15 marca' },
  WASTESYNC_ANNUAL_REPORT_DUE: { en: 'Yearly BDO report still to be filed', pl: 'Roczne sprawozdanie BDO do złożenia' },
  WASTESYNC_MONTHLY_DATA_MISSING: { en: 'Finished months with no waste data recorded', pl: 'Zakończone miesiące bez ewidencji odpadów' },
  WASTESYNC_THRESHOLD_BREACH: { en: 'Waste totals exceed a configured threshold', pl: 'Sumy odpadów przekraczają ustalony próg' },

  // PrivacyPilot
  PRIVACY_BREACH_UODO_OVERDUE: { en: 'Breaches past the 72-hour UODO deadline', pl: 'Naruszenia po 72-godzinnym terminie zgłoszenia do UODO' },
  PRIVACY_BREACH_UODO_WINDOW: { en: 'Breaches still to be reported to UODO within 72 h', pl: 'Naruszenia do zgłoszenia do UODO w ciągu 72 h' },
  PRIVACY_BREACH_SUBJECTS_PENDING: { en: 'Affected people still have to be notified', pl: 'Osoby, których dotyczy naruszenie, do zawiadomienia' },
  PRIVACY_DSAR_OVERDUE: { en: 'Data-subject requests past their legal deadline', pl: 'Wnioski osób po terminie ustawowym' },
  PRIVACY_DSAR_DUE_SOON: { en: 'Data-subject requests due within 7 days', pl: 'Wnioski osób z terminem w ciągu 7 dni' },
  PRIVACY_DPIA_REQUIRED: { en: 'Activities need a DPIA before they may continue', pl: 'Czynności wymagają DPIA przed dalszym przetwarzaniem' },
  PRIVACY_PRIOR_CONSULTATION: { en: 'Prior consultation with UODO is outstanding', pl: 'Zaległa uprzednia konsultacja z UODO' },
  PRIVACY_VENDOR_DPA_MISSING: { en: 'Processors used with no data-processing agreement', pl: 'Przetwarzający bez umowy powierzenia' },
  PRIVACY_TRANSFER_TIA_MISSING: { en: 'Transfers outside the EEA with no impact assessment', pl: 'Transfery poza EOG bez oceny skutków' },
  PRIVACY_ROPA_REVIEW_OVERDUE: { en: 'Register entries are past their review date', pl: 'Wpisy rejestru po terminie przeglądu' },
};

// ── Fixed screen text ────────────────────────────────────────────────────────

export const UI_TEXT = {
  title: { en: 'Compliance Overview', pl: 'Przegląd zgodności' },
  subtitleWithNip: { en: 'NIP', pl: 'NIP' },
  needsAttention: { en: 'Needs attention', pl: 'Wymaga działania' },
  allClear: { en: 'No open compliance obligations across your modules.', pl: 'Brak otwartych obowiązków zgodności w Twoich modułach.' },
  invoiceVolume: { en: 'KSeF invoice volume (12 months)', pl: 'Liczba faktur w KSeF (12 miesięcy)' },
  recentActivity: { en: 'Recent module activity', pl: 'Ostatnia aktywność w modułach' },
  activityEmpty: { en: 'No recorded activity yet.', pl: 'Brak zapisanej aktywności.' },
  activityNote: {
    en: 'Whistleblower activity is not shown here — reports stay confidential to their handlers.',
    pl: 'Aktywność zgłoszeń sygnalistów nie jest tu pokazywana — pozostaje poufna dla prowadzących.',
  },
  headlineActiveUsers: { en: 'Active users', pl: 'Aktywni użytkownicy' },
  headlineModules: { en: 'Modules available to you', pl: 'Dostępne moduły' },
  headlineOpenActions: { en: 'Open compliance actions', pl: 'Otwarte działania zgodności' },
  headlinePlan: { en: 'Plan', pl: 'Plan' },
  overdueOf: { en: 'overdue', pl: 'po terminie' },
  seatsOf: { en: 'of', pl: 'z' },
  daysLeft: { en: 'days left', pl: 'dni do końca' },
  planExpired: { en: 'expired', pl: 'wygasł' },
  noExpiry: { en: 'no expiry set', pl: 'brak daty wygaśnięcia' },
  newThisMonth: { en: 'new this month', pl: 'nowych w tym miesiącu' },
  updatedAt: { en: 'Updated', pl: 'Zaktualizowano' },
  refresh: { en: 'Refresh', pl: 'Odśwież' },
  staleWarning: {
    en: 'Showing the last successful load — the latest refresh failed.',
    pl: 'Pokazujemy ostatnie udane pobranie — najnowsze odświeżenie nie powiodło się.',
  },
  loadFailed: { en: 'Could not load the compliance overview.', pl: 'Nie udało się pobrać przeglądu zgodności.' },
  open: { en: 'Open', pl: 'Otwórz' },
  minimisationNote: {
    en: 'Figures only. This overview holds no employee names or personal details.',
    pl: 'Tylko dane zbiorcze. Ten przegląd nie zawiera nazwisk ani danych osobowych.',
  },
};

// ── Lookup + formatting ──────────────────────────────────────────────────────

/** Pick the active-language string out of a { en, pl } entry. */
export function pick(entry, fallback = '') {
  if (!entry) return fallback;
  return entry[activeLanguage()] ?? entry.en ?? fallback;
}

export const moduleLabel = (code) => pick(MODULE_LABELS[code], code);
export const metricLabel = (key) => pick(METRIC_LABELS[key], key);
export const attentionLabel = (type) => pick(ATTENTION_LABELS[type], type);
export const cardStatusLabel = (status) => pick(CARD_STATUS_LABELS[status], status);
export const text = (key) => pick(UI_TEXT[key], key);

/**
 * Format a metric value for display using the unit the server declared.
 *
 * The server always sends machine values ("1240.50", "84", "2027-06-01") and the
 * number/date formatting happens here, in the user's own locale. That is why an
 * amount shows as "1 240,50" for a Polish user and "1,240.50" for an English one
 * from the very same response.
 */
export function formatMetric(metric) {
  const locale = activeLanguage() === 'pl' ? 'pl-PL' : 'en-GB';
  const raw = metric?.value;
  if (raw === null || raw === undefined || raw === '') return '—';

  switch (metric.unit) {
    case 'PERCENT':
      return `${Number(raw).toLocaleString(locale)}%`;
    case 'HOURS':
      return `${Number(raw).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;
    case 'KG':
      return `${Number(raw).toLocaleString(locale, { maximumFractionDigits: 1 })} kg`;
    case 'MONEY':
      // The currency is the last part of the key, e.g. "…grossThisYear.PLN".
      return `${Number(raw).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencyOf(metric.key)}`;
    case 'DATE':
      return formatDate(raw);
    case 'COUNT':
      return Number(raw).toLocaleString(locale);
    default:
      return String(raw);
  }
}

/** Money metric keys end with the currency code, so the label can stay generic. */
export function currencyOf(key) {
  const parts = String(key ?? '').split('.');
  const last = parts[parts.length - 1];
  return /^[A-Z]{3}$/.test(last) ? last : '';
}

/** A money metric's label is shared across currencies, so build it from the stem. */
export function moneyMetricLabel(key) {
  const currency = currencyOf(key);
  const stem = currency ? key.slice(0, -(currency.length + 1)) : key;
  const base = METRIC_LABELS[stem]
    ? pick(METRIC_LABELS[stem])
    : pick(METRIC_LABELS['ksef.totals.grossThisYear'], stem);
  return currency ? `${base} (${currency})` : base;
}

/** Dates and timestamps in the user's own locale; unparseable input passes through. */
export function formatDate(value, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const locale = activeLanguage() === 'pl' ? 'pl-PL' : 'en-GB';
  return withTime ? date.toLocaleString(locale) : date.toLocaleDateString(locale);
}

// The generic label for the KSeF money totals, whose real keys carry a currency
// suffix and therefore cannot be listed one by one.
METRIC_LABELS['ksef.totals.grossThisYear'] = {
  en: 'Invoiced this year (gross)',
  pl: 'Zafakturowano w tym roku (brutto)',
};
