// Polskie tłumaczenie całej aplikacji WorkPulse.
//
// Polish wording for the whole WorkPulse app. This is the DEFAULT language,
// because WorkPulse is built for the Polish market and is used every day by
// Polish workers, HR staff and labour inspectors.
//
// The keys here MUST match en.js exactly. If a key is missing here the app falls
// back to the English wording rather than showing an empty space
// (see hooks/useTranslation.js).
//
// TERMINOLOGY NOTE
// The wording follows the Kodeks pracy (Polish Labour Code), because these
// screens are working-time evidence that a PIP inspector may read:
//   ewidencja czasu pracy  = the working-time record (art. 149)
//   okres rozliczeniowy    = the settlement period (art. 150)
//   nadgodziny             = overtime (art. 151)
//   odpoczynek dobowy      = daily rest (art. 132)
//   pracownik młodociany   = young worker (art. 203)

const pl = {
  // ── Słowa używane na wielu ekranach ────────────────────────────────────────
  common: {
    loading: "Ładowanie…",
    save: "Zapisz",
    saving: "Zapisywanie…",
    cancel: "Anuluj",
    close: "Zamknij",
    previous: "Poprzednia",
    next: "Następna",
    signIn: "Zaloguj się",
    signOut: "Wyloguj się",
    employee: "Pracownik",
    date: "Data",
    from: "Od",
    to: "Do",
    days: "Dni",
    status: "Status",
    actions: "Akcje",
    reason: "Powód",
    type: "Rodzaj",
    worked: "Przepracowano",
    break: "Przerwa",
    overtime: "Nadgodziny",
    in: "Wejście",
    out: "Wyjście",
    approve: "Zatwierdź",
    reject: "Odrzuć",
    ok: "OK",
    blocked: "Zablokowano",
    none: "—",
    pleaseWait: "Proszę czekać…",
    viewOnly: "Tylko do wglądu",
    // Skróty jednostek używane przy formatowaniu czasu, np. "8 godz. 30 min".
    hourShort: "godz.",
    minuteShort: "min",
    minutesShort: "{{count}} min",
    hoursSuffix: "{{count}} godz.",
  },

  // ── Przełącznik PL / EN w nagłówku ────────────────────────────────────────
  language: {
    label: "Język",
    polish: "polski",
    english: "angielski",
    switchTo: "Przełącz na {{language}}",
  },

  // ── Nagłówek / nawigacja ──────────────────────────────────────────────────
  //
  // MENU LABELS ARE DELIBERATELY SHORT.
  // Polish names for these screens are much longer than the English ones —
  // "Ewidencja czasu pracy" is 21 characters against 12 for "Time Records".
  // With eight items the full names do not fit across one row, so the menu used
  // to wrap and look broken.
  //
  // These keys are used ONLY by the header (components/layout/Header.jsx), so
  // shortening them changes nothing else: each page still shows its full legal
  // name in its own heading (records.title = "Ewidencja czasu pracy",
  // settlement.title = "Rozliczenie okresu", timesheet.title = "Moja karta
  // pracy"). Hovering a menu item also shows the full name as a tooltip.
  nav: {
    clock: "Zegar",
    myTimesheet: "Karta pracy",
    absences: "Nieobecności",
    timeRecords: "Ewidencja",
    dashboard: "Panel",
    settlement: "Rozliczenie",
    policy: "Regulamin",
    audit: "Audyt",
    tagline: "Polska · Czas pracy",
    toggleMenu: "Pokaż lub ukryj menu",
  },

  footer: {
    rights: "© 2026 WorkPulse Polska. Wszelkie prawa zastrzeżone.",
    tagline: "Dowód czasu pracy · Kodeks pracy",
  },

  // ── Przerwy (art. 134) ────────────────────────────────────────────────────
  breakStatus: {
    compliant: "Przerwa OK",
    short: "Zbyt krótka przerwa",
    missing: "Brak przerwy",
    notNeeded: "Przerwa niewymagana",
  },

  // ── Stan wpisu czasu pracy ────────────────────────────────────────────────
  entryStatus: {
    open: "W pracy",
    onBreak: "Na przerwie",
    completed: "Zakończone",
    missingClockOut: "Brak wyjścia",
    autoClosed: "Zamknięte automatycznie",
  },

  // ── Rodzaje nieobecności (nazwy zgodne z Kodeksem pracy) ─────────────────
  absenceType: {
    ANNUAL_LEAVE: "Urlop wypoczynkowy",
    ON_DEMAND_LEAVE: "Urlop na żądanie",
    SICK_LEAVE: "Zwolnienie lekarskie (L4)",
    UNPAID_LEAVE: "Urlop bezpłatny",
    MATERNITY_LEAVE: "Urlop macierzyński / rodzicielski",
    CHILDCARE_LEAVE: "Urlop wychowawczy",
    SPECIAL_LEAVE: "Urlop okolicznościowy",
    PUBLIC_HOLIDAY: "Dzień świąteczny",
    OTHER: "Inne",
  },

  // ── Stan wniosku o nieobecność ────────────────────────────────────────────
  absenceStatus: {
    PENDING: "Oczekuje",
    APPROVED: "Zatwierdzony",
    REJECTED: "Odrzucony",
    CANCELLED: "Anulowany",
  },

  // ── Ekran „Zegar" ─────────────────────────────────────────────────────────
  clock: {
    loading: "Ładowanie zegara…",
    cannotClockIn: "Nie możesz rozpocząć pracy",
    safeWorkNote:
      "Ta blokada wynika z Twoich danych zgodności w SafeWork (badania lekarskie / szkolenie BHP). Skontaktuj się z administratorem.",
    welcomeBack: "Witaj ponownie",
    welcomeBackNamed: "Witaj ponownie, {{name}}",
    dailyNorm: "Norma dobowa: {{hours}} godz. · system {{system}}",
    clockIn: "Rozpocznij pracę",
    complianceUpToDate: "✓ Twoje badania i szkolenia BHP są aktualne",
    locationWillBeRecorded:
      "📍 Twoja lokalizacja zostanie zapisana przy rozpoczęciu pracy (zaakceptowałeś informację o monitorowaniu).",

    monitoringTitle: "Informacja o monitorowaniu lokalizacji",
    monitoringSubtitle:
      "Wymagane przez art. 22² Kodeksu pracy · wersja informacji {{version}}",
    monitoringAccept: "Zapoznałem się i akceptuję",

    working: "W pracy",
    onBreak: "Na przerwie",
    since: "od {{time}}",
    workedSoFar: "Przepracowany czas",
    onBreakFor: "Na przerwie od {{duration}}",
    startBreak: "Rozpocznij przerwę",
    endBreak: "Zakończ przerwę",
    clockOut: "Zakończ pracę",

    breakTaken: "Wykorzystana przerwa",
    breakRequired: "Wymagane: {{minutes}}",
    breakStatusTitle: "Status przerwy",
    breakNotRequiredYet: "Jeszcze niewymagana",
    breakCompliant: "Zgodna z przepisami",
    breakDue: "Przerwa należna",
    breakRule: "6 godz. → 15 min · 9 godz. → 30 min",
    overtimeSoFar: "Nadgodziny",
    normLabel: "Norma: {{duration}}",
  },

  // ── Moja karta pracy ──────────────────────────────────────────────────────
  timesheet: {
    title: "Moja karta pracy",
    subtitle: "Twój zapisany czas pracy i przerwy",
    daysShown: "Pokazane dni",
    totalWorked: "Łącznie przepracowano",
    totalOvertime: "Łącznie nadgodzin",
    empty: "Brak wpisów czasu pracy. Rozpocznij pracę na ekranie Zegar.",
    pendingSuffix: " (oczekuje)",

    myCompliance: "Moja zgodność w tym okresie",
    attentionNeeded: "Wymaga uwagi",
    nearYearlyLimit: "Blisko limitu rocznego",
    withinLimits: "W granicach norm",
    averageWeeklyHours: "Średni tygodniowy czas pracy",
    overtimeThisYear: "Nadgodziny w tym roku",
    capSuffix: "/ limit {{hours}} godz.",
    limitSuffix: "/ limit {{hours}} godz.",
  },

  // ── Nieobecności ──────────────────────────────────────────────────────────
  absences: {
    title: "Nieobecności",
    subtitle: "Urlopy, zwolnienia i inne dni wolne",
    requestTitle: "Zgłoś nieobecność",
    start: "Początek",
    end: "Koniec",
    reasonOptional: "Powód (opcjonalnie)",
    submit: "Wyślij wniosek",
    submitting: "Wysyłanie…",
    chooseDates: "Wybierz datę początkową i końcową.",
    mine: "Moje nieobecności",
    all: "Wszystkie nieobecności",
    empty: "Brak nieobecności.",
  },

  // ── Ewidencja czasu pracy (cała firma) ────────────────────────────────────
  records: {
    title: "Ewidencja czasu pracy",
    subtitleFull:
      "Wszystkie wpisy czasu pracy · zatwierdzanie nadgodzin · korekty",
    subtitleReadOnly: "Wszystkie wpisy czasu pracy · tylko do wglądu",
    inOut: "Wejście / Wyjście",
    approveOvertime: "Zatwierdź nadg.",
    correct: "Popraw",
    correctedFlag: "poprawiony",
    restViolation: "odpoczynek <11 godz.",
    empty: "Brak wpisów.",
    filterAll: "Wszystkie",

    correctTitle: "Popraw wpis czasu pracy",
    correctClockIn: "Wejście",
    correctClockOut: "Wyjście",
    correctReason: "Powód (wymagany)",
    correctReasonPlaceholder: "np. pracownik zapomniał zakończyć pracę",
    correctSave: "Zapisz korektę",
    correctReasonMissing: "Powód korekty jest wymagany.",
  },

  // ── Panel ─────────────────────────────────────────────────────────────────
  dashboard: {
    title: "Panel",
    subtitle: "Bieżący przegląd czasu pracy w Twojej organizacji",
    loading: "Ładowanie panelu…",
    clockedInNow: "Obecnie w pracy",
    onBreakNow: "Na przerwie",
    completedToday: "Zakończone dziś",
    missingClockOut: "Brak wyjścia",
    needsAttention: "Wymaga uwagi",
    overtimeAwaiting: "Nadgodziny oczekujące na zatwierdzenie",
    absencesPending: "Wnioski o nieobecność oczekujące",
    last7Days: "Ostatnie 7 dni",
    workedHours: "Przepracowane godziny",
    overtimeHours: "Godziny nadliczbowe",
    missingBreaks: "Brakujące przerwy",
    shortBreaks: "Zbyt krótkie przerwy",
    restViolations: "Naruszenia odpoczynku (11 godz.)",
    todaysEntries: "Dzisiejsze wpisy",
    noActivityToday: "Brak aktywności dzisiaj.",
    recentActivity: "Ostatnia aktywność",
    noRecentActivity: "Brak ostatniej aktywności.",
    blockedSuffix: " (zablokowano)",
  },

  // ── Okres rozliczeniowy ───────────────────────────────────────────────────
  settlement: {
    title: "Rozliczenie okresu",
    subtitle:
      "Okres rozliczeniowy — średnio 48 godz. tygodniowo (art. 131) i 150 godz. nadliczbowych rocznie (art. 151 §3)",
    onlyBreaches: "Tylko przekroczenia",
    currentPeriod: "Bieżący okres",
    calculating: "Rozliczanie godzin…",
    noBreaches: "Brak przekroczeń limitów w tym okresie. 🎉",
    noEntries: "Brak wpisów czasu pracy w tym okresie.",
    workedPeriod: "Przepracowano (okres)",
    avgWeeklyCap: "Śr. tygodniowo (≤48 godz.)",
    overtimeYearCap: "Nadgodziny (rok, ≤150 godz.)",
    overCap: "{{hours}} godz. — ponad 48 godz.",
    overLimit: "{{duration}} — ponad limit",
    nearLimit: "{{duration}} — blisko limitu",
    protections: "Ochrona",
    open: "Otwórz",

    myTitle: "Mój okres rozliczeniowy",
    mySubtitle:
      "Okres rozliczeniowy — Twój średni tydzień (art. 131) i Twoje nadgodziny w tym roku (art. 151 §3)",
    myLoading: "Obliczanie Twoich godzin…",
    whereYouStand: "Twoja sytuacja",
    workedThisPeriod: "Przepracowano w okresie",
    averageWeek: "Średni tydzień",
    overtimeThisYear: "Nadgodziny w tym roku",
    capSuffix: "/ limit {{hours}} godz.",
    limitSuffix: "/ limit {{hours}} godz.",
    overALegalLimit: "Przekroczony limit ustawowy",
    nearYearlyLimit: "Blisko limitu rocznego",
    withinLimits: "W granicach norm",
    myNote:
      "Twój średni tygodniowy czas pracy nie może przekroczyć 48 godzin łącznie z nadgodzinami (art. 131), a nadgodziny nie mogą przekroczyć limitu rocznego (art. 151 §3). Jeśli któraś wartość jest czerwona, skontaktuj się z działem HR.",

    protectionsTitle: "Ochrona czasu pracy",
    protectionsLoading: "Ładowanie profilu…",
    protectionsViewOnly:
      "Tylko do wglądu — możesz zobaczyć te dane, ale nie możesz ich zmienić.",
    pregnant: "Pracownica w ciąży",
    pregnantHint: "Zakaz nadgodzin i pracy w nocy (art. 178 §1)",
    youngWorker: "Pracownik młodociany",
    youngWorkerHint: "Zakaz nadgodzin i pracy w nocy (art. 203)",
    parentUnder4: "Rodzic dziecka do lat 4",
    parentUnder4Hint: "Nadgodziny / praca w nocy tylko za zgodą (art. 178 §2)",
    consentTitle: "Zgoda (dla rodzica małego dziecka)",
    consentOvertime: "Zgadza się na nadgodziny",
    consentNightWork: "Zgadza się na pracę w nocy",
  },

  // ── Regulamin czasu pracy ─────────────────────────────────────────────────
  policy: {
    title: "Regulamin czasu pracy",
    subtitleEdit: "Regulamin czasu pracy — zasady stosowane przez system",
    subtitleRead: "Regulamin czasu pracy — zasady, które Cię dotyczą",
    viewOnlyTitle: "Tylko do wglądu.",
    viewOnlyBody:
      "To zasady czasu pracy ustalone przez Twojego pracodawcę. Ich zmiana należy do pracodawcy (art. 150 Kodeksu pracy), dlatego tę stronę może edytować wyłącznie administrator.",
    saved: "Regulamin zapisany.",
    noPolicy: "Brak regulaminu",

    system: "System czasu pracy",
    dailyNorm: "Norma dobowa (godziny)",
    weeklyNorm: "Norma tygodniowa (godziny)",
    workDaysPerWeek: "Dni pracy w tygodniu",
    settlementPeriodMonths: "Okres rozliczeniowy (miesiące)",
    dailyRest: "Odpoczynek dobowy (godziny)",
    weeklyRest: "Odpoczynek tygodniowy (godziny)",
    overtimeNeedsApproval:
      "Nadgodziny muszą być zatwierdzone przez przełożonego, aby zostały zaliczone",

    limitsTitle: "Limity okresu rozliczeniowego",
    maxAvgWeekly: "Maks. średni tygodniowy czas pracy (art. 131)",
    annualOvertimeLimit: "Roczny limit nadgodzin — godziny (art. 151 §3)",

    nightTitle: "Praca w porze nocnej",
    nightStart: "Początek pory nocnej (godzina)",
    nightEnd: "Koniec pory nocnej (godzina)",
    nightPremium: "Dodatek nocny (%)",

    locationTitle: "Monitorowanie lokalizacji",
    locationIntro:
      "Domyślnie wyłączone. Włączenie powoduje zapisywanie miejsca rozpoczęcia pracy z telefonu — jest to monitoring pracownika w rozumieniu art. 22², dlatego pracownicy muszą najpierw zaakceptować informację.",
    recordLocation: "Zapisuj lokalizację wejścia / wyjścia",
    blockOutside: "Blokuj rozpoczęcie pracy poza miejscem pracy",
    ignoreGpsWorse: "Ignoruj GPS o dokładności gorszej niż (metry)",
    allowedSites: "Dozwolone miejsca pracy",
    addSite: "+ Dodaj miejsce",
    noSites:
      "Nie ustawiono miejsc pracy. Bez nich nie można sprawdzić obecności na miejscu — lokalizacja jest tylko zapisywana.",
    site: "Miejsce",
    latitude: "Szerokość geogr.",
    longitude: "Długość geogr.",
    radius: "Promień (m)",
    remove: "Usuń",
    monitoringNoticeText: "Informacja o monitorowaniu pokazywana pracownikom",

    breakRuleTitle: "Zasada przerw (ustalona ustawowo, art. 134):",
    breakRuleBody:
      "co najmniej 15 min, gdy dobowy czas pracy osiągnie 6 godz., +15 min powyżej 9 godz., +15 min powyżej 16 godz. Nadgodziny to czas przepracowany powyżej normy dobowej, a nie po prostu długa zmiana.",
    savePolicy: "Zapisz regulamin",

    // Siedem systemów czasu pracy dopuszczonych przez Kodeks pracy.
    systems: {
      STANDARD: "Podstawowy — 8 godz./dobę, 40 godz./tydzień",
      EQUIVALENT: "Równoważny",
      TASK_BASED: "Zadaniowy",
      SHORTENED_WEEK: "Skrócony tydzień pracy",
      WEEKEND_WORK: "Weekendowy (praca w weekendy)",
      FLEXIBLE: "Ruchomy",
      INDIVIDUAL: "Indywidualny rozkład czasu pracy",
    },
  },

  // ── Rejestr audytowy ──────────────────────────────────────────────────────
  audit: {
    title: "Rejestr audytowy",
    subtitle:
      "Niezmienny zapis każdej operacji na czasie pracy (przechowywanie 10 lat)",
    loading: "Ładowanie rejestru…",
    when: "Kiedy",
    user: "Użytkownik",
    action: "Operacja",
    resource: "Zasób",
    result: "Wynik",
    empty: "Brak zapisów audytowych.",
    pageOf: "Strona {{page}} z {{total}}",
    filterAll: "Wszystkie",
  },

  // ── Powiadomienia (dzwonek) ───────────────────────────────────────────────
  notifications: {
    title: "Powiadomienia",
    live: "Na żywo",
    reconnecting: "Ponowne łączenie…",
    markAllRead: "Oznacz wszystkie jako przeczytane",
    empty: "Nie masz powiadomień.",
    aria: "Powiadomienia",
    ariaWithUnread: "Powiadomienia, {{count}} nieprzeczytanych",
  },

  // ── Ekrany blokady dostępu ────────────────────────────────────────────────
  access: {
    signedInAs: "Zalogowano jako",

    suspendedEyebrow: "Konto zawieszone",
    suspendedTitle: "Twoje konto zostało zawieszone",
    suspendedMessage:
      "Twoje konto jest obecnie wyłączone, dlatego WorkPulse jest niedostępny. Skontaktuj się z administratorem, aby ponownie aktywować konto.",

    moduleEyebrow: "Dostęp ograniczony",
    moduleTitle: "WorkPulse nie jest częścią Twojego planu",
    moduleMessage:
      "Twoje konto nie obejmuje modułu WorkPulse. Skontaktuj się z administratorem, aby dodać WorkPulse do subskrypcji Twojej organizacji.",

    planEyebrow: "Subskrypcja wygasła",
    planTitle: "Twój plan wygasł",
    planMessage:
      "Subskrypcja Twojej organizacji zakończyła się, dlatego WorkPulse jest tymczasowo zablokowany. Skontaktuj się z administratorem, aby odnowić plan i przywrócić dostęp.",

    permissionEyebrow: "Wymagane uprawnienie",
    permissionTitle: "Nie masz dostępu do WorkPulse",
    permissionMessage:
      "Twoja organizacja korzysta z WorkPulse, ale Twoje konto nie otrzymało uprawnienia do jego otwarcia. Poproś administratora o nadanie dostępu do WorkPulse.",

    pageEyebrow: "Niedostępne dla Twojej roli",
    pageTitle: "Ta strona nie należy do Twojej roli",
    pageMessage:
      "Masz dostęp do WorkPulse, ale ta strona jest zarezerwowana dla innych roli. Jeśli uważasz, że jest Ci potrzebna, poproś administratora.",
  },

  // ── Logowanie / SSO ───────────────────────────────────────────────────────
  login: {
    redirecting: "Przekierowanie do logowania RegulaOne…",
    returnNote: "Po zalogowaniu wrócisz automatycznie do WorkPulse.",
    verifying: "Weryfikacja sesji…",
  },

  // ── 404 ───────────────────────────────────────────────────────────────────
  notFound: {
    title: "Strona nie znaleziona",
    message: "Strona, której szukasz, nie istnieje.",
    back: "Powrót do Zegara",
  },
};

export default pl;
