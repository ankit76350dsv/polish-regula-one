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

  // ── The personal "My Workspace" figures (GET /api/me/overview) ─────────────
  //
  // Every key below starts with "my." and every figure is the SIGNED-IN PERSON'S
  // OWN record — their shifts, their certificate, the invoices they typed. The
  // wording therefore says "I" and "my", never "employees", so nobody mistakes
  // their own count for a team total.

  // KSeFFlow — my own invoices
  'my.ksef.invoices.created': { en: 'Invoices I created', pl: 'Faktury utworzone przeze mnie' },
  'my.ksef.invoices.thisMonth': { en: 'I created this month', pl: 'Utworzone przeze mnie w tym miesiącu' },
  'my.ksef.invoices.draft': { en: 'My drafts', pl: 'Moje wersje robocze' },
  'my.ksef.invoices.pending': { en: 'Mine awaiting KSeF', pl: 'Moje oczekują na KSeF' },
  'my.ksef.invoices.sent': { en: 'Mine accepted by KSeF', pl: 'Moje przyjęte przez KSeF' },
  'my.ksef.invoices.failed': { en: 'Mine rejected by KSeF', pl: 'Moje odrzucone przez KSeF' },
  'my.ksef.invoices.offlineQueued': { en: 'Mine queued offline', pl: 'Moje w kolejce offline' },
  'my.ksef.invoices.deadlineBreached': { en: 'Mine past the KSeF deadline', pl: 'Moje po terminie przesłania' },
  'my.ksef.upo.missing': { en: 'Mine accepted without stored UPO', pl: 'Moje przyjęte bez zapisanego UPO' },

  // WorkPulse — my own working time
  'my.workpulse.today.status': { en: 'My shift today', pl: 'Moja zmiana dziś' },
  'my.workpulse.today.workedHours': { en: 'Hours I worked today', pl: 'Godziny przepracowane dziś' },
  'my.workpulse.month.shifts': { en: 'My shifts this month', pl: 'Moje zmiany w tym miesiącu' },
  'my.workpulse.month.workedHours': { en: 'Hours I worked this month', pl: 'Godziny przepracowane w tym miesiącu' },
  'my.workpulse.month.overtimeHours': { en: 'My overtime this month', pl: 'Moje nadgodziny w tym miesiącu' },
  'my.workpulse.month.nightShifts': { en: 'My night shifts this month', pl: 'Moje zmiany nocne w tym miesiącu' },
  'my.workpulse.month.sundayHolidayShifts': { en: 'My Sunday / holiday shifts', pl: 'Moje zmiany w niedziele i święta' },
  'my.workpulse.year.overtimeHours': { en: 'My overtime this year', pl: 'Moje nadgodziny w tym roku' },
  'my.workpulse.year.overtimeLimitHours': { en: 'Yearly overtime limit', pl: 'Roczny limit nadgodzin' },
  'my.workpulse.window.missingBreak': { en: 'My shifts with no break', pl: 'Moje zmiany bez przerwy' },
  'my.workpulse.window.shortBreak': { en: 'My shifts with too short a break', pl: 'Moje zmiany ze zbyt krótką przerwą' },
  'my.workpulse.window.dailyRestViolations': { en: 'My daily rest below 11 h', pl: 'Mój odpoczynek dobowy poniżej 11 h' },
  'my.workpulse.window.weeklyRestViolations': { en: 'My weekly rest below 35 h', pl: 'Mój odpoczynek tygodniowy poniżej 35 h' },
  'my.workpulse.window.missingClockOut': { en: 'My shifts with no clock-out', pl: 'Moje zmiany bez wyjścia' },
  'my.workpulse.absences.pending': { en: 'My absence requests awaiting a decision', pl: 'Moje wnioski o nieobecność do decyzji' },
  'my.workpulse.absences.upcomingApproved': { en: 'My approved upcoming absences', pl: 'Moje zatwierdzone przyszłe nieobecności' },
  'my.workpulse.approvals.overtimePending': { en: 'My overtime awaiting approval', pl: 'Moje nadgodziny do zatwierdzenia' },
  'my.workpulse.settlement.overWeeklyAverageCap': { en: 'I am above the 48 h average week', pl: 'Przekraczam przeciętnie 48 h tygodniowo' },
  'my.workpulse.monitoring.acknowledged': { en: 'I acknowledged the monitoring notice', pl: 'Potwierdziłem(-am) informację o monitoringu' },

  // SafeWork — my own health-and-safety paperwork
  'my.safework.profile.status': { en: 'My compliance status', pl: 'Mój status zgodności' },
  'my.safework.blocked': { en: 'I am blocked from clocking in', pl: 'Mam zablokowane wejście' },
  'my.safework.medical.expiry': { en: 'My medical certificate valid until', pl: 'Moje badania lekarskie ważne do' },
  'my.safework.bhp.expiry': { en: 'My BHP training valid until', pl: 'Moje szkolenie BHP ważne do' },

  // SafeVoice — only the cases assigned to me, and only for a case handler
  'my.safevoice.cases.assignedOpen': { en: 'Open reports assigned to me', pl: 'Otwarte zgłoszenia przydzielone mnie' },
  'my.safevoice.cases.acknowledgementOverdue': { en: 'Mine not confirmed within 7 days', pl: 'Moje bez potwierdzenia w 7 dni' },
  'my.safevoice.cases.feedbackOverdue': { en: 'Mine past the 3-month feedback deadline', pl: 'Moje po 3-miesięcznym terminie odpowiedzi' },
  'my.safevoice.cases.feedbackDueSoon': { en: 'Mine with feedback due in 14 days', pl: 'Moje z odpowiedzią w ciągu 14 dni' },
  'my.safevoice.messages.unread': { en: 'Unread messages on my cases', pl: 'Nieprzeczytane wiadomości w moich sprawach' },

  // WasteSync — only the waste records I entered
  'my.wastesync.entries.thisYear': { en: 'Records I entered this year', pl: 'Wpisy wprowadzone przeze mnie w tym roku' },
  'my.wastesync.entries.lastPeriod': { en: 'Newest month I recorded', pl: 'Najnowszy zaewidencjonowany miesiąc' },
  'my.wastesync.entries.lastRecordedAt': { en: 'I last recorded on', pl: 'Ostatni wpis dnia' },
  'my.wastesync.entries.corrections': { en: 'My records later corrected', pl: 'Moje wpisy później poprawione' },
  'my.wastesync.totals.thisYearKg': { en: 'Waste I recorded this year', pl: 'Odpady zaewidencjonowane przeze mnie w tym roku' },

  // PrivacyPilot — only the records I created
  'my.privacypilot.activities.created': { en: 'Processing activities I entered', pl: 'Czynności przetwarzania wprowadzone przeze mnie' },
  'my.privacypilot.activities.reviewOverdue': { en: 'Mine past their review date', pl: 'Moje po terminie przeglądu' },
  'my.privacypilot.dpia.required': { en: 'My activities needing a DPIA', pl: 'Moje czynności wymagające DPIA' },
  'my.privacypilot.dpia.inProgress': { en: 'My DPIAs in progress', pl: 'Moje DPIA w toku' },
  'my.privacypilot.breaches.open': { en: 'Breaches I reported, still open', pl: 'Zgłoszone przeze mnie naruszenia, otwarte' },
  'my.privacypilot.breaches.uodoWindowOpen': { en: 'Mine inside the 72 h UODO window', pl: 'Moje w 72-godzinnym oknie UODO' },
  'my.privacypilot.breaches.uodoOverdue': { en: 'Mine past the 72 h UODO deadline', pl: 'Moje po terminie 72 h do UODO' },
  'my.privacypilot.dsar.open': { en: 'Data-subject requests I handle', pl: 'Prowadzone przeze mnie wnioski osób' },
  'my.privacypilot.dsar.dueSoon': { en: 'Mine due within 7 days', pl: 'Moje z terminem w 7 dni' },
  'my.privacypilot.dsar.overdue': { en: 'Mine past their deadline', pl: 'Moje po terminie' },
};

/**
 * Metrics the server sends as "1" or "0" because the underlying fact is yes/no.
 *
 * WHY THIS LIST EXISTS: the API keeps a single COUNT type rather than inventing a
 * boolean unit, which is right for the server. But a card reading "I am blocked
 * from clocking in — 1" is close to meaningless to the person reading it, so those
 * keys are rendered as Yes / No here, where the wording already lives.
 */
const BOOLEAN_METRIC_KEYS = new Set([
  'my.safework.blocked',
  'my.workpulse.monitoring.acknowledged',
  'my.workpulse.settlement.overWeeklyAverageCap',
]);

// ── Status words the API sends as codes ──────────────────────────────────────
//
// These arrive as the VALUE of a metric (unit "TEXT") or of a document, not as a
// key, so they need their own table. Anything not listed falls back to the raw
// value — which is what keeps a plain text value like the "2026-07" reporting
// month from being mangled.

export const STATUS_VALUE_LABELS = {
  // WorkPulse — my shift today
  NOT_STARTED: { en: 'Not started', pl: 'Nierozpoczęta' },
  OPEN: { en: 'In progress', pl: 'W toku' },
  ON_BREAK: { en: 'On a break', pl: 'Na przerwie' },
  COMPLETED: { en: 'Finished', pl: 'Zakończona' },
  MISSING_CLOCK_OUT: { en: 'Not clocked out', pl: 'Brak wyjścia' },

  // SafeWork — may I work today?
  COMPLIANT: { en: 'In order', pl: 'W porządku' },
  EXPIRING: { en: 'Expiring soon', pl: 'Wygasa wkrótce' },
  NON_COMPLIANT: { en: 'Not in order', pl: 'Nie w porządku' },
  BLOCKED: { en: 'Blocked from working', pl: 'Zablokowany(-a)' },
  NO_PROFILE: { en: 'Profile not set up yet', pl: 'Profil jeszcze nieutworzony' },

  // Document validity
  VALID: { en: 'Valid', pl: 'Ważne' },
  EXPIRED: { en: 'Expired', pl: 'Wygasłe' },
  MISSING: { en: 'Never provided', pl: 'Brak' },
  NOT_REQUIRED: { en: 'Not required for my role', pl: 'Niewymagane na moim stanowisku' },

  // Company account status
  ACTIVE: { en: 'Active', pl: 'Aktywna' },
  INACTIVE: { en: 'Inactive', pl: 'Nieaktywna' },
  SUSPENDED: { en: 'Suspended', pl: 'Zawieszona' },

  // Yes / no, for the boolean metrics above
  YES: { en: 'Yes', pl: 'Tak' },
  NO: { en: 'No', pl: 'Nie' },
};

// ── My own compliance documents ──────────────────────────────────────────────

export const DOCUMENT_TYPE_LABELS = {
  MEDICAL_CERTIFICATE: {
    en: 'Occupational medical certificate',
    pl: 'Orzeczenie lekarskie (badania profilaktyczne)',
  },
  BHP_TRAINING: {
    en: 'Health & safety (BHP) training',
    pl: 'Szkolenie BHP',
  },
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

  // ── My own to-do list (GET /api/me/overview) ───────────────────────────────
  //
  // The MY_* items are the same obligations seen from the other side: the admin
  // list says "employees are blocked", this one says "you are blocked". Each is
  // phrased as something THIS PERSON can act on, because that is the only kind of
  // item that belongs on their own screen.

  // WorkPulse — my working time
  MY_WORKPULSE_TODAY_NOT_CLOSED: {
    en: 'You did not clock out — close today’s shift',
    pl: 'Nie zarejestrowano wyjścia — zamknij dzisiejszą zmianę',
  },
  MY_WORKPULSE_MISSING_CLOCK_OUT: {
    en: 'Your earlier shifts were never clocked out — your record is incomplete',
    pl: 'Wcześniejsze zmiany bez wyjścia — Twoja ewidencja jest niepełna',
  },
  MY_WORKPULSE_MISSING_BREAK: {
    en: 'Your shifts were recorded with no legally required break',
    pl: 'Twoje zmiany zapisano bez wymaganej prawem przerwy',
  },
  MY_WORKPULSE_DAILY_REST_VIOLATION: {
    en: 'You had less than 11 hours of rest between shifts',
    pl: 'Miałeś(-aś) mniej niż 11 h odpoczynku między zmianami',
  },
  MY_WORKPULSE_WEEKLY_REST_VIOLATION: {
    en: 'You had no 35-hour continuous weekly rest',
    pl: 'Brak 35 h nieprzerwanego odpoczynku tygodniowego',
  },
  MY_WORKPULSE_WEEKLY_AVERAGE_CAP_EXCEEDED: {
    en: 'Your average working week is above the 48-hour limit',
    pl: 'Twój przeciętny tydzień pracy przekracza 48 h',
  },
  MY_WORKPULSE_ANNUAL_OVERTIME_EXCEEDED: {
    en: 'You are above 150 overtime hours for this year',
    pl: 'Przekroczyłeś(-aś) 150 h nadliczbowych w tym roku',
  },
  MY_WORKPULSE_ANNUAL_OVERTIME_NEAR: {
    en: 'You are close to your yearly overtime limit',
    pl: 'Zbliżasz się do rocznego limitu nadgodzin',
  },
  MY_WORKPULSE_OVERTIME_AWAITING_DECISION: {
    en: 'Your overtime is waiting for a manager’s decision',
    pl: 'Twoje nadgodziny czekają na decyzję przełożonego',
  },
  MY_WORKPULSE_ABSENCE_AWAITING_DECISION: {
    en: 'Your absence request is waiting for a decision',
    pl: 'Twój wniosek o nieobecność czeka na decyzję',
  },
  MY_WORKPULSE_MONITORING_NOTICE_PENDING: {
    en: 'Read and acknowledge the workplace monitoring notice',
    pl: 'Przeczytaj i potwierdź informację o monitoringu w pracy',
  },

  // SafeWork — my paperwork. EXPIRED and MISSING both mean the law does not let
  // this person work, which is why they are worded as a stop rather than a nudge.
  MY_SAFEWORK_BLOCKED: {
    en: 'You may not clock in — your health & safety documents are not valid',
    pl: 'Nie możesz rozpocząć pracy — Twoje dokumenty BHP są nieważne',
  },
  MY_SAFEWORK_PROFILE_MISSING: {
    en: 'You have no SafeWork profile yet — ask HR to set it up',
    pl: 'Nie masz jeszcze profilu SafeWork — poproś HR o jego utworzenie',
  },
  MY_SAFEWORK_MEDICAL_EXPIRED: {
    en: 'Your medical certificate has expired — you may not work until it is renewed',
    pl: 'Twoje badania lekarskie wygasły — nie możesz pracować do ich odnowienia',
  },
  MY_SAFEWORK_MEDICAL_MISSING: {
    en: 'Your medical certificate was never provided',
    pl: 'Nie dostarczono Twoich badań lekarskich',
  },
  MY_SAFEWORK_MEDICAL_EXPIRING: {
    en: 'Your medical certificate expires within 30 days — book an appointment',
    pl: 'Twoje badania lekarskie wygasają w ciągu 30 dni — zapisz się na wizytę',
  },
  MY_SAFEWORK_BHP_EXPIRED: {
    en: 'Your BHP training has expired — you may not work until it is repeated',
    pl: 'Twoje szkolenie BHP wygasło — nie możesz pracować do jego powtórzenia',
  },
  MY_SAFEWORK_BHP_MISSING: {
    en: 'Your BHP training was never recorded',
    pl: 'Nie zapisano Twojego szkolenia BHP',
  },
  MY_SAFEWORK_BHP_EXPIRING: {
    en: 'Your BHP training expires within 30 days — arrange a refresher',
    pl: 'Twoje szkolenie BHP wygasa w ciągu 30 dni — ustal termin odświeżenia',
  },

  // KSeFFlow — the invoices I typed
  MY_KSEF_SUBMISSION_DEADLINE_BREACHED: {
    en: 'Your invoices are past their KSeF submission deadline',
    pl: 'Twoje faktury są po terminie przesłania do KSeF',
  },
  MY_KSEF_INVOICES_FAILED: {
    en: 'KSeF rejected your invoices — correct and resend them',
    pl: 'KSeF odrzucił Twoje faktury — popraw je i wyślij ponownie',
  },
  MY_KSEF_OFFLINE_QUEUE: {
    en: 'Your invoices are still waiting in the offline queue',
    pl: 'Twoje faktury czekają w kolejce offline',
  },
  MY_KSEF_UPO_MISSING: {
    en: 'Your accepted invoices have no UPO confirmation stored',
    pl: 'Twoje przyjęte faktury nie mają zapisanego UPO',
  },
  MY_KSEF_DRAFTS_UNFINISHED: {
    en: 'You have unfinished invoice drafts',
    pl: 'Masz niedokończone wersje robocze faktur',
  },

  // SafeVoice — only the cases assigned to me
  MY_SAFEVOICE_ACKNOWLEDGEMENT_OVERDUE: {
    en: 'Your assigned reports were not acknowledged within 7 days',
    pl: 'Twoje zgłoszenia bez potwierdzenia w ciągu 7 dni',
  },
  MY_SAFEVOICE_FEEDBACK_OVERDUE: {
    en: 'Your assigned reports are past the 3-month feedback deadline',
    pl: 'Twoje zgłoszenia po 3-miesięcznym terminie odpowiedzi',
  },
  MY_SAFEVOICE_FEEDBACK_DUE_SOON: {
    en: 'Feedback on your assigned reports is due soon',
    pl: 'Zbliża się termin odpowiedzi w Twoich zgłoszeniach',
  },
  MY_SAFEVOICE_REPORTER_WAITING: {
    en: 'A reporter is waiting for your reply',
    pl: 'Zgłaszający czeka na Twoją odpowiedź',
  },

  // PrivacyPilot — only the records I created or handle
  MY_PRIVACY_BREACH_UODO_OVERDUE: {
    en: 'Breaches you reported are past the 72-hour UODO deadline',
    pl: 'Zgłoszone przez Ciebie naruszenia po 72-godzinnym terminie do UODO',
  },
  MY_PRIVACY_BREACH_UODO_WINDOW: {
    en: 'Breaches you reported must reach UODO within 72 hours',
    pl: 'Zgłoszone przez Ciebie naruszenia trzeba przekazać do UODO w 72 h',
  },
  MY_PRIVACY_DSAR_OVERDUE: {
    en: 'Requests you handle are past their legal deadline',
    pl: 'Prowadzone przez Ciebie wnioski po terminie ustawowym',
  },
  MY_PRIVACY_DSAR_DUE_SOON: {
    en: 'Requests you handle are due within 7 days',
    pl: 'Prowadzone przez Ciebie wnioski z terminem w ciągu 7 dni',
  },
  MY_PRIVACY_DPIA_REQUIRED: {
    en: 'Activities you entered need a DPIA before they may continue',
    pl: 'Wprowadzone przez Ciebie czynności wymagają DPIA',
  },
  MY_PRIVACY_ROPA_REVIEW_OVERDUE: {
    en: 'Register entries you own are past their review date',
    pl: 'Twoje wpisy w rejestrze są po terminie przeglądu',
  },
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
  activityUser: { en: 'User', pl: 'Użytkownik' },
  activityAction: { en: 'Action', pl: 'Czynność' },
  activityModule: { en: 'Module', pl: 'Moduł' },
  activityWhen: { en: 'When', pl: 'Kiedy' },
  activityFailed: { en: 'Failed', pl: 'Niepowodzenie' },
  opensInNewTab: { en: 'opens in a new tab', pl: 'otwiera się w nowej karcie' },
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

  // ── The personal "My Workspace" screen ─────────────────────────────────────
  myTitle: { en: 'My Workspace', pl: 'Mój pulpit' },
  myGreeting: { en: 'Welcome back', pl: 'Witaj ponownie' },
  myScopeNote: {
    en: 'Your own records only. Nothing here shows a colleague’s data or a company total.',
    pl: 'Tylko Twoje własne dane. Nie ma tu danych współpracowników ani sum firmowych.',
  },
  myNoCompany: {
    en: 'Your account is not linked to a company yet, so there is nothing to show. An administrator has to add you first.',
    pl: 'Twoje konto nie jest jeszcze powiązane z firmą, więc nie ma czego pokazać. Administrator musi najpierw Cię dodać.',
  },
  myLoadFailed: { en: 'Could not load your workspace.', pl: 'Nie udało się pobrać Twojego pulpitu.' },

  // Top row
  myShiftToday: { en: 'My shift today', pl: 'Moja zmiana dziś' },
  myHoursThisMonth: { en: 'Hours this month', pl: 'Godziny w tym miesiącu' },
  myOvertimeNote: { en: 'overtime', pl: 'nadgodzin' },
  myDocumentStatus: { en: 'May I work today?', pl: 'Czy mogę dziś pracować?' },
  myOpenActions: { en: 'My open actions', pl: 'Moje otwarte działania' },

  // The one banner that stops somebody from working
  myBlockedTitle: { en: 'You may not start work', pl: 'Nie możesz rozpocząć pracy' },
  myBlockedBody: {
    en: 'Your occupational medical certificate or BHP training is not valid, so clocking in is blocked. Polish law (Kodeks pracy art. 229 §4 and art. 237³) does not allow work without them. Contact HR to renew.',
    pl: 'Twoje badania lekarskie lub szkolenie BHP są nieważne, dlatego rejestracja wejścia jest zablokowana. Kodeks pracy (art. 229 §4 i art. 237³) nie pozwala na pracę bez nich. Skontaktuj się z HR, aby je odnowić.',
  },

  // Sections
  myTodo: { en: 'What I have to do', pl: 'Co mam zrobić' },
  myAllClear: { en: 'Nothing is waiting for you. Everything on your side is in order.', pl: 'Nic na Ciebie nie czeka. Po Twojej stronie wszystko jest w porządku.' },
  myDocuments: { en: 'My compliance documents', pl: 'Moje dokumenty zgodności' },
  myDocumentsNote: {
    en: 'Validity dates only — no medical findings are stored or shown here.',
    pl: 'Tylko daty ważności — nie przechowujemy ani nie pokazujemy tu wyników badań.',
  },
  myDocumentsEmpty: {
    en: 'No SafeWork profile yet, so there are no documents to show.',
    pl: 'Brak profilu SafeWork, więc nie ma dokumentów do pokazania.',
  },
  myExpiresOn: { en: 'Valid until', pl: 'Ważne do' },
  myNoDate: { en: 'no date recorded', pl: 'brak zapisanej daty' },
  myDaysLeft: { en: 'days left', pl: 'dni do końca' },
  myDaysAgo: { en: 'days overdue', pl: 'dni po terminie' },
  myNotRequired: { en: 'Not required for your role', pl: 'Niewymagane na Twoim stanowisku' },

  // My rights (GDPR Art. 13–14, whistleblower act)
  myRights: { en: 'My rights and where to use them', pl: 'Moje prawa i gdzie z nich korzystać' },
  myRightsNote: {
    en: 'What the company must tell you, and how to raise a concern.',
    pl: 'Co firma musi Ci przekazać i jak zgłosić nieprawidłowość.',
  },
  myPrivacyNotices: { en: 'Privacy notices available to you', pl: 'Dostępne informacje o przetwarzaniu' },
  myPrivacyNoticesLegal: { en: 'GDPR Art. 13–14 / RODO art. 13–14', pl: 'RODO art. 13–14' },
  myDpo: { en: 'Data protection officer', pl: 'Inspektor ochrony danych' },
  myDpoLegal: { en: 'GDPR Art. 13(1)(b) / RODO art. 13 ust. 1 lit. b', pl: 'RODO art. 13 ust. 1 lit. b' },
  myDpoNone: { en: 'Not appointed', pl: 'Nie wyznaczono' },
  myWhistleblowing: { en: 'Confidential reporting channel', pl: 'Poufny kanał zgłoszeń' },
  myWhistleblowingLegal: {
    en: 'Whistleblower Protection Act (Dz.U. 2024 poz. 928); Directive (EU) 2019/1937',
    pl: 'Ustawa o ochronie sygnalistów (Dz.U. 2024 poz. 928); dyrektywa (UE) 2019/1937',
  },
  myWhistleblowingAvailable: { en: 'Available — reports can be made confidentially', pl: 'Dostępny — zgłoszenia można składać poufnie' },
  myWhistleblowingNone: { en: 'Not set up in your company', pl: 'Nieuruchomiony w Twojej firmie' },
  myOpenLink: { en: 'Open', pl: 'Otwórz' },
  myLatestNotice: { en: 'Latest issued', pl: 'Ostatnia wydana' },

  // My audit trail
  myActivity: { en: 'What has been recorded under my name', pl: 'Co zapisano pod moim nazwiskiem' },
  myActivityNote: {
    en: 'Your own audit entries only, so you can check what the system holds about your actions.',
    pl: 'Tylko Twoje zapisy audytowe, abyś mógł(-a) sprawdzić, co system zapisał o Twoich działaniach.',
  },
  myActivityEmpty: { en: 'Nothing has been recorded under your name yet.', pl: 'Jeszcze nic nie zapisano pod Twoim nazwiskiem.' },
  myModulesNote: { en: 'Modules you can open', pl: 'Moduły, które możesz otworzyć' },

  // ── The SuperAdmin "Platform Overview" screen ──────────────────────────────
  platformTitle: { en: 'Platform Overview', pl: 'Przegląd platformy' },
  platformSubtitle: { en: 'customer companies across 6 modules', pl: 'firm klienckich w 6 modułach' },
  platformScopeNote: {
    en: 'Commercial figures only. This screen holds no customer compliance data — that belongs to each customer and is visible to their own administrator.',
    pl: 'Tylko dane handlowe. Ten ekran nie zawiera danych zgodności klientów — należą one do klienta i są widoczne dla jego administratora.',
  },
  platformLoadFailed: { en: 'Could not load the platform overview.', pl: 'Nie udało się pobrać przeglądu platformy.' },

  // Top row
  platformCustomers: { en: 'Customer companies', pl: 'Firmy klienckie' },
  platformActive: { en: 'active', pl: 'aktywnych' },
  platformNewThisMonth: { en: 'new this month', pl: 'nowych w tym miesiącu' },
  platformSignupTrend: { en: 'signups vs last month', pl: 'rejestracje vs poprzedni miesiąc' },
  platformUsers: { en: 'People using the platform', pl: 'Osoby korzystające z platformy' },
  platformSeats: { en: 'seats sold', pl: 'sprzedanych stanowisk' },
  platformSeatsNotStated: { en: 'no seat limit set', pl: 'brak ustalonego limitu stanowisk' },
  platformUtilisation: { en: 'Seat utilisation', pl: 'Wykorzystanie stanowisk' },
  platformOverSeats: { en: 'over the seats sold', pl: 'powyżej sprzedanych stanowisk' },
  platformMrr: { en: 'Monthly recurring value', pl: 'Wartość miesięczna powtarzalna' },
  platformMrrNote: {
    en: 'Live plans that have not lapsed. Never converted between currencies.',
    pl: 'Aktywne, nieprzedawnione plany. Bez przeliczania między walutami.',
  },
  platformNoRevenue: { en: 'No active priced plan', pl: 'Brak aktywnego płatnego planu' },
  platformMoreCurrencies: { en: 'more currencies', pl: 'inne waluty' },

  // Subscriptions — what replaced the invented "compliance score"
  platformPlans: { en: 'Subscriptions', pl: 'Subskrypcje' },
  platformPlansNote: {
    en: 'The state of customers’ plans. This is billing, not compliance — whether a customer is compliant is answered on their own dashboard.',
    pl: 'Stan planów klientów. To rozliczenia, nie zgodność — o zgodności klienta mówi jego własny pulpit.',
  },
  platformPlanValid: { en: 'Paid up', pl: 'Opłacone' },
  platformPlanExpiring: { en: 'Expiring within 30 days', pl: 'Wygasają w ciągu 30 dni' },
  platformPlanExpired: { en: 'Lapsed', pl: 'Przedawnione' },
  platformPlanNone: { en: 'No plan at all', pl: 'Brak jakiegokolwiek planu' },
  platformSuspended: { en: 'Suspended accounts', pl: 'Konta zawieszone' },
  platformInactive: { en: 'Inactive accounts', pl: 'Konta nieaktywne' },

  // Billings chart
  platformBillings: { en: 'Billed per month (6 months)', pl: 'Zafakturowano miesięcznie (6 miesięcy)' },
  platformBillingsNote: {
    en: 'The value of the paid periods that started in each month. Not the same figure as the recurring value above — an annual plan is billed once, in the month it starts.',
    pl: 'Wartość okresów rozliczeniowych rozpoczętych w danym miesiącu. To nie ta sama liczba co wartość powtarzalna powyżej — plan roczny jest fakturowany raz, w miesiącu rozpoczęcia.',
  },
  platformBillingsEmpty: { en: 'Nothing was billed in this period.', pl: 'W tym okresie nic nie zafakturowano.' },

  // Module adoption
  platformAdoption: { en: 'Module take-up', pl: 'Wykorzystanie modułów' },
  platformAdoptionNote: {
    en: 'Share of active customers whose plan includes the module, and how many people were actually granted it.',
    pl: 'Udział aktywnych klientów, których plan obejmuje moduł, oraz liczba osób, którym faktycznie go nadano.',
  },
  platformAdoptionCustomers: { en: 'customers', pl: 'klientów' },
  platformAdoptionUsers: { en: 'people granted', pl: 'osób z dostępem' },

  // Watchlist
  platformWatchlist: { en: 'Customers needing attention', pl: 'Klienci wymagający uwagi' },
  platformWatchlistNote: {
    en: 'Plan dates, account status and seat counts. Worst first.',
    pl: 'Daty planów, status konta i liczba stanowisk. Najpilniejsze na górze.',
  },
  platformWatchlistEmpty: {
    en: 'No customer needs attention — every account is live and paid up.',
    pl: 'Żaden klient nie wymaga uwagi — wszystkie konta są aktywne i opłacone.',
  },
  platformDaysLeft: { en: 'days left', pl: 'dni do końca' },
  platformDaysOverdue: { en: 'days overdue', pl: 'dni po terminie' },
  platformOpenCustomer: { en: 'Open', pl: 'Otwórz' },
};

// ── Why a customer is on the platform watchlist ──────────────────────────────
//
// Every reason is commercial — a plan date, an account status or a seat count.
// Nothing here comes from a customer's module data.

export const WATCHLIST_REASON_LABELS = {
  TENANT_SUSPENDED: {
    en: 'Account suspended — the customer cannot use the platform',
    pl: 'Konto zawieszone — klient nie może korzystać z platformy',
  },
  PLAN_EXPIRED: {
    en: 'Plan has lapsed — filing tools stop working',
    pl: 'Plan przedawniony — narzędzia do składania przestają działać',
  },
  PLAN_EXPIRING: {
    en: 'Plan expires soon — arrange the renewal',
    pl: 'Plan wygasa wkrótce — ustal odnowienie',
  },
  NO_PLAN: {
    en: 'Active account with no plan assigned',
    pl: 'Aktywne konto bez przypisanego planu',
  },
  SEATS_EXCEEDED: {
    en: 'More people enabled than seats sold',
    pl: 'Więcej aktywnych osób niż sprzedanych stanowisk',
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
export const documentTypeLabel = (type) => pick(DOCUMENT_TYPE_LABELS[type], type);

/**
 * Turn a status CODE into words.
 *
 * Falls back to the value itself rather than to a placeholder, because the same
 * function also sees ordinary text values (a "2026-07" reporting month, for
 * example) that must pass through untouched.
 */
export const statusValueLabel = (value) =>
  value === null || value === undefined || value === ''
    ? '—'
    : pick(STATUS_VALUE_LABELS[value], String(value));

export const watchlistReasonLabel = (reason) =>
  pick(WATCHLIST_REASON_LABELS[reason], reason);

/**
 * An amount with its currency, in the reader's own locale.
 *
 * The currency ALWAYS comes from the server alongside the amount — it is never
 * assumed. The platform dashboard used to print a hardcoded "€" in front of a total
 * that had summed PLN and EUR plan prices together, so the symbol was wrong and the
 * number underneath it was meaningless. `Intl.NumberFormat` also puts the symbol
 * where the locale expects it, which matters here: Polish writes "1 234,50 zł" after
 * the number, English writes "€1,234.50" before it.
 */
export function formatMoney(amount, currency) {
  if (amount === null || amount === undefined) return '—';
  const locale = activeLanguage() === 'pl' ? 'pl-PL' : 'en-GB';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || 'PLN',
      maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    // An unknown or malformed currency code must not blank the figure out — show the
    // number with the code beside it instead.
    return `${Number(amount).toLocaleString(locale, { maximumFractionDigits: 2 })} ${currency ?? ''}`.trim();
  }
}

/**
 * A compact amount for a stat card: "1,2 mln zł", "82,4 tys. zł", "950 zł".
 *
 * Long money strings break a card's layout, so large values are shortened — but the
 * currency is still taken from the data, never assumed.
 */
export function formatMoneyShort(amount, currency) {
  if (amount === null || amount === undefined) return '—';
  const locale = activeLanguage() === 'pl' ? 'pl-PL' : 'en-GB';
  const value = Number(amount);

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || 'PLN',
      notation: Math.abs(value) >= 10_000 ? 'compact' : 'standard',
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return formatMoney(amount, currency);
  }
}

/**
 * "2026-08" → "Aug 2026" / "sie 2026".
 *
 * The server sends the machine value so the month name can be produced in the
 * reader's language here. The old platform API formatted month names server-side with
 * Locale.ENGLISH, which pinned the chart to English on a Polish-first product.
 */
export function formatMonth(yearMonth) {
  if (!yearMonth) return '—';
  const [year, month] = String(yearMonth).split('-');
  if (!year || !month) return String(yearMonth);

  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return String(yearMonth);

  const locale = activeLanguage() === 'pl' ? 'pl-PL' : 'en-GB';
  return date.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
}

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

  // A yes/no fact the API had to send as 1 or 0. Checked before the unit, because
  // those metrics are declared COUNT and would otherwise print a bare digit.
  if (BOOLEAN_METRIC_KEYS.has(metric.key)) {
    return statusValueLabel(String(raw) === '1' ? 'YES' : 'NO');
  }

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
    case 'TEXT':
      // Status codes ("ON_BREAK", "COMPLIANT") become words; anything else, such
      // as the "2026-07" reporting month, is shown exactly as the server sent it.
      return statusValueLabel(raw);
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
