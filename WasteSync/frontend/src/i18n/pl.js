// Polish wording for every screen in WasteSync.
//
// Polish is the DEFAULT language, because WasteSync files reports with the Polish
// BDO register (Baza danych o produktach i opakowaniach oraz o gospodarce
// odpadami) and is used day to day by Polish staff.
//
// This file has EXACTLY the same keys as en.js. If a key is missing here the app
// falls back to the English wording rather than showing an empty space, so a
// missing translation is never a blank screen — but it is still a gap worth
// filling (see hooks/useTranslation.js).
//
// Wording notes for whoever edits this next:
//   - Official register words are kept as they are used in Poland: "BDO",
//     "sprawozdanie", "NIP", "REGON", "opłata roczna". Do not "translate" them
//     into something friendlier — an inspector expects these exact words.
//   - Sentences with a month or a category in them are phrased so the word can
//     stay in its plain (nominative) form. Polish changes word endings by case,
//     and a placeholder cannot be bent to fit, so the sentence is built around
//     it instead.

const pl = {
  common: {
    save: "Zapisz",
    saving: "Zapisywanie…",
    cancel: "Anuluj",
    clear: "Wyczyść",
    open: "Otwórz",
    view: "Pokaż",
    change: "Zmień",
    previous: "Poprzednia",
    next: "Następna",
    year: "Rok",
    month: "Miesiąc",
    total: "Suma",
    status: "Status",
    actions: "Akcje",
    category: "Kategoria",
    loading: "Wczytywanie…",
    notSet: "Nie ustawiono",
    // These describe a company (firma — a feminine word), so the endings are
    // feminine. The subscription plan uses its own words further down, because
    // "plan" is masculine and would need a different ending.
    active: "Aktywna",
    inactive: "Nieaktywna",
    expired: "Wygasła",
    none: "Brak",
    kg: "kg",
    empty: "—",
  },

  language: {
    label: "Język",
    polish: "polski",
    english: "angielski",
    switchTo: "Przełącz na {{language}}",
  },

  nav: {
    brandTagline: "Sprawozdawczość BDO",
    dashboard: "Pulpit",
    company: "Firma",
    wasteEntries: "Ewidencja odpadów",
    reports: "Sprawozdania",
    thresholds: "Progi prawne",
    auditLogs: "Dziennik audytu",
    signedIn: "Zalogowano",
    logOut: "Wyloguj się",
  },

  footer: {
    copyright: "© {{year}} DSV Corporation — WasteSync (platforma RegulaOne)",
    tagline: "Sprawozdawczość odpadowa i opakowaniowa BDO · Polska / EOG",
  },

  auth: {
    redirecting: "Przekierowanie do logowania RegulaOne…",
    returnAfterSignIn: "Po zalogowaniu automatycznie wrócisz do WasteSync.",
    verifying: "Weryfikacja sesji…",
  },

  // Month names in their plain form. The charts shorten them to the first three
  // letters, which gives the usual Polish short forms (sty, lut, mar, kwi, maj,
  // cze, lip, sie, wrz, paź, lis, gru).
  months: {
    1: "styczeń",
    2: "luty",
    3: "marzec",
    4: "kwiecień",
    5: "maj",
    6: "czerwiec",
    7: "lipiec",
    8: "sierpień",
    9: "wrzesień",
    10: "październik",
    11: "listopad",
    12: "grudzień",
  },

  // The five kinds of packaging waste. The KEYS are the codes the backend and the
  // BDO XML use and must never change — only this wording is translated.
  categories: {
    PAPER: "Papier i tektura",
    PLASTIC: "Tworzywa sztuczne",
    GLASS: "Szkło",
    METAL: "Metale",
    MIXED: "Wielomateriałowe",
  },

  dashboard: {
    eyebrow: "WasteSync · Sprawozdawczość BDO",
    title: "Pulpit",
    loading: "Wczytywanie pulpitu…",
    subtitle: "Przegląd sprawozdawczości za {{year}}",
    subtitleWithCompany: "{{company}} · Przegląd sprawozdawczości za {{year}}",

    metrics: {
      entriesThisYear: "Zapisy w tym roku",
      reportsGenerated: "Wygenerowane sprawozdania",
      missingMonths: "Brakujące miesiące",
      totalWaste: "Odpady łącznie (kg)",
      needsAttention: "Wymaga uwagi",
      allCaughtUp: "Wszystko uzupełnione",
    },

    charts: {
      byCategory: "Odpady według kategorii (kg)",
      monthlyTrend: "Trend miesięczny (kg)",
    },

    alerts: {
      title: "Alerty zgodności",
      none: "Brak problemów — wszystko wygląda dobrze.",
    },

    reportingStatus: {
      title: "Status sprawozdania ({{year}})",
      nothingYet: "Nie ma jeszcze czego raportować.",
      yourCompany: "Twoja firma",
      noBdoNumber: "Nie ustawiono numeru BDO",
      reported: "Zgłoszone",
      notReported: "Niezgłoszone",
    },

    recentReports: {
      title: "Ostatnie sprawozdania",
      viewAll: "Pokaż wszystkie",
      none: "Nie wygenerowano jeszcze żadnych sprawozdań.",
    },

    recentActivity: {
      title: "Ostatnia aktywność",
      viewAuditLog: "Pokaż dziennik audytu",
      none: "Brak aktywności.",
    },
  },

  // The 15 March filing deadline banner. Every sentence here is about a legal
  // date, so the wording stays plain and never sounds hopeful.
  filing: {
    overdueTitle: "Sprawozdanie za {{year}} jest zaległe",
    overdueGenerated:
      "Termin upłynął {{date}} ({{days}} dni temu). Sprawozdanie zostało wygenerowane, ale nie oznaczono go jeszcze jako złożone w portalu BDO.",
    overdueNotGenerated:
      "Termin upłynął {{date}} ({{days}} dni temu), a sprawozdanie nie zostało jeszcze wygenerowane.",
    filedTitle: "Sprawozdanie za {{year}} zostało złożone",
    filedDetail: "Nic nie zalega. Termin następnego sprawozdania to {{date}}.",
    // Polish uses "dzień" for exactly one day and "dni" for every other number,
    // so two forms are enough here.
    dueSoonTitleOne: "Do złożenia sprawozdania za {{year}} pozostał 1 dzień",
    dueSoonTitle: "Do złożenia sprawozdania za {{year}} pozostało {{days}} dni",
    dueSoonDetail: "Należy je złożyć w portalu BDO do {{date}}.",
    dueSoonGeneratedSuffix:
      " Zostało już wygenerowane — oznacz je jako złożone po wysłaniu do portalu.",
    nextTitle: "Następne sprawozdanie BDO: {{year}}",
    nextDetail: "Termin: {{date}} — pozostało {{days}} dni.",
    predatesAccount:
      " Wcześniejsze lata nie są pokazywane, ponieważ pochodzą z okresu przed utworzeniem tego konta — w razie potrzeby sprawdź je bezpośrednio w portalu BDO.",
    annualFee:
      "Osobnym obowiązkiem jest opłata roczna za wpis do rejestru, płatna do {{date}}. WasteSync nie śledzi płatności.",
    goToReports: "Przejdź do sprawozdań",
  },

  wasteEntries: {
    eyebrow: "WasteSync · Zapisy miesięczne",
    title: "Ewidencja odpadów",
    subtitleWrite:
      "Zapisuj miesięczne ilości odpadów opakowaniowych. Zapisane dane nigdy nie są nadpisywane — korekta tworzy nową wersję.",
    subtitleRead:
      "Miesięczne ilości odpadów opakowaniowych, wraz z każdą poprzednią wersją danego miesiąca.",
    monthsRecorded: "Zapisane miesiące",
    loading: "Wczytywanie zapisów…",

    metrics: {
      totalYear: "Suma {{year}} (kg)",
      monthsRecorded: "Zapisane miesiące",
      pctOfYear: "{{pct}}% roku",
      notRecordedYet: "Jeszcze niezapisane",
      fullYearCaptured: "Cały rok uzupełniony",
      monthsStillBlank: "Miesiące nadal puste",
      largestCategory: "Największa kategoria",
      noFiguresYet: "Brak danych",
    },

    form: {
      title: "Zapisz / popraw miesiąc",
      hint: "korekta jest zapisywana jako nowa wersja, nic nie jest nadpisywane",
      currentVersion: "Bieżąca wersja: v{{version}}",
      notRecordedYet: "Jeszcze niezapisane",
      stillBlank: "Nadal puste",
      kgAriaLabel: "{{category}} w kilogramach",
      notes: "Uwagi (opcjonalnie)",
      notesPlaceholder: "np. poprawione po weryfikacji faktur",
      save: "Zapisz miesiąc",
      // Written as a label with a colon so the month name can stay in its plain
      // form instead of needing a different ending.
      savingHint: "Zapis: {{month}} {{year}}",
    },

    table: {
      title: "Dane miesięczne {{year}}",
      hint: "{{count}} z 12 miesięcy",
      allWeightsInKg: "Wszystkie masy w kilogramach",
      history: "Historia",
      yearTotal: "Suma roczna",
      recorded: "Zapisane",
      corrected: "Skorygowane · v{{version}}",
      blank: "Brak danych",
    },

    history: {
      title: "Historia wersji: {{month}} {{year}}",
      subtitle: "Każda wersja kiedykolwiek zapisana dla tego miesiąca",
      close: "Zamknij historię wersji",
      loading: "Wczytywanie historii…",
      none: "Nie znaleziono historii.",
      current: "(bieżąca)",
      total: "Suma: {{kg}} kg",
    },
  },

  reports: {
    title: "Sprawozdania roczne",
    subtitleGenerate:
      "Generuj roczne sprawozdania BDO (XML do portalu + PDF do dokumentacji).",
    subtitleRead:
      "Roczne sprawozdania BDO. Otwórz wybrane, aby zobaczyć dane i pobrać XML lub PDF.",
    generate: "Generuj sprawozdanie",
    generating: "Generowanie…",
    loading: "Wczytywanie sprawozdań…",
    emptyTitle: "Brak sprawozdań",
    emptyMessageGenerate:
      "Wybierz rok powyżej, a następnie wygeneruj pierwsze sprawozdanie roczne.",
    emptyMessageRead:
      "Nie wygenerowano jeszcze żadnych sprawozdań rocznych, więc nie ma tu czego sprawdzać.",

    table: {
      company: "Firma",
      bdoNumber: "Numer BDO",
      totalKg: "Suma (kg)",
      compliance: "Zgodność",
      version: "Wersja",
    },

    passed: "Spełnione",
    breach: "Przekroczenie",
    submitted: "Złożone",
    generated: "Wygenerowane",
  },

  reportDetail: {
    title: "Sprawozdanie roczne — {{year}}",
    subtitle: "{{company}} · BDO {{bdo}}",
    loading: "Wczytywanie sprawozdania…",
    downloadXml: "Pobierz XML",
    downloadPdf: "Pobierz PDF",
    markSubmitted: "Oznacz jako złożone",
    downloadError: "Nie udało się uzyskać linku do pobrania pliku {{format}}",
    version: "Wersja {{version}}",
    submittedToBdo: "Złożone w BDO",
    generated: "Wygenerowane",
    thresholdsNotEvaluated: "Progi niesprawdzone",
    thresholdsPassed: "Progi spełnione",
    thresholdBreach: "Przekroczenie progu",
    notFiledNotice:
      "To sprawozdanie zostało wygenerowane, ale nie oznaczono go jeszcze jako złożone w BDO. Tylko administrator może potwierdzić złożenie.",
    noThresholdsNotice:
      "Dla roku {{year}} nie ustawiono żadnych progów prawnych, więc sumy nie zostały porównane z żadnym limitem. Ustaw limity na stronie Progi prawne, aby ta kontrola miała sens.",
    breachesTitle: "Problemy z progami prawnymi:",
    missingMonths: "Nie zapisano danych za: {{months}}.",
    totalsTitle: "Sumy roczne według kategorii",
    grandTotal: "Suma całkowita",
    detailsTitle: "Szczegóły sprawozdania",
    reportingYear: "Rok sprawozdawczy",
    bdoNumber: "Numer BDO",
    generatedAt: "Wygenerowano",
    backToReports: "← Powrót do sprawozdań",
  },

  thresholds: {
    title: "Progi prawne",
    subtitle:
      "Ustaw prawne limity BDO, z którymi porównywane jest każde sprawozdanie roczne.",
    readOnlyNotice:
      "Możesz zobaczyć ustawione limity, ale tylko administrator może je zmieniać.",
    hint:
      "Wartości podawane są w kilogramach (kg). Pozostaw pole puste, aby nie ustawiać limitu dla tej kategorii. Maksimum prawne nie może być niższe niż próg sprawozdawczy.",
    loading: "Wczytywanie progów…",
    reportingThreshold: "Próg sprawozdawczy (kg)",
    legalMaximum: "Maksimum prawne (kg)",
    configured: "Ustawiony",
    savedNotice: "Zapisano limit dla kategorii {{category}} ({{year}}).",
    removedNotice: "Usunięto limit dla kategorii {{category}} ({{year}}).",
    loadError: "Nie udało się wczytać progów",
    saveError: "Nie udało się zapisać limitu dla kategorii {{category}}",
    removeError: "Nie udało się usunąć limitu dla kategorii {{category}}",
  },

  audit: {
    title: "Dziennik audytu",
    subtitle:
      "Każde ważne działanie jest tutaj zapisywane. Wpisy są niezmienne i przechowywane przez 10 lat.",
    filterLabel: "Działanie",
    allActions: "Wszystkie działania",
    loading: "Wczytywanie dziennika audytu…",
    none: "Nie znaleziono wpisów audytu.",
    pagination: "Strona {{page}} z {{totalPages}} · {{total}} wpisów",

    table: {
      when: "Kiedy",
      action: "Działanie",
      user: "Użytkownik",
      resource: "Zasób",
      ip: "IP",
    },

    // Friendly wording for the filter dropdown only. The codes in the table itself
    // are never translated — an audit record must read the same for an inspector
    // whatever language the screen happens to be in.
    actionNames: {
      LOGIN: "Zalogowanie",
      LOGOUT: "Wylogowanie",
      COMPANY_CREATED: "Utworzenie firmy",
      COMPANY_UPDATED: "Aktualizacja firmy",
      WASTE_ENTRY_CREATED: "Zapis odpadów",
      WASTE_ENTRY_CORRECTED: "Korekta zapisu odpadów",
      REPORT_GENERATED: "Wygenerowanie sprawozdania",
      REPORT_DOWNLOADED: "Pobranie sprawozdania",
      REPORT_SUBMITTED: "Złożenie sprawozdania",
      ACCESS_DENIED: "Odmowa dostępu",
    },
  },

  company: {
    title: "Firma",
    subtitle:
      "Dane Twojej firmy pochodzą z RegulaOne. Zmień je tam, a tutaj zaktualizują się automatycznie.",
    loading: "Wczytywanie danych firmy…",
    bdoMissingWrite:
      "Dodaj poniżej 9-cyfrowy numer rejestrowy BDO. Bez niego nie można generować sprawozdań.",
    bdoMissingRead:
      "Ta firma nie ma jeszcze numeru rejestrowego BDO. Osoba zarządzająca danymi firmy musi go dodać, zanim będzie można generować sprawozdania.",
    bdoBadge: "BDO {{number}}",
    noBdoNumber: "Brak numeru BDO",
    managedInRegulaOne: "Zarządzane w RegulaOne",
    footnote:
      "Dane firmy są odczytywane z RegulaOne przy każdym otwarciu tej strony. WasteSync nie przechowuje ich kopii, więc to, co widzisz, jest zawsze aktualne.",

    identity: {
      title: "Dane firmy",
      name: "Nazwa firmy",
      nip: "NIP (numer podatkowy)",
      regon: "REGON",
      registeredOn: "Data rejestracji",
    },

    contact: {
      title: "Kontakt",
      email: "E-mail",
      phone: "Telefon",
    },

    address: {
      title: "Adres siedziby",
      street: "Ulica",
      postalCode: "Kod pocztowy",
      city: "Miejscowość",
      country: "Kraj",
    },

    bdo: {
      title: "Numer rejestrowy BDO",
      addNumber: "Dodaj numer",
      description:
        "9-cyfrowy numer z polskiego rejestru BDO. Jest umieszczany na każdym sprawozdaniu, a RegulaOne go nie przechowuje, dlatego ustawia się go tutaj.",
      save: "Zapisz numer",
      notSetYet: "Jeszcze nie ustawiono",
      invalid: "Numer BDO musi mieć dokładnie 9 cyfr.",
    },

    subscription: {
      title: "Subskrypcja",
      planStatus: "Status planu",
      planExpires: "Plan wygasa",
      enabledModules: "Włączone moduły",
      // "Plan" is masculine in Polish, so these need different endings from the
      // company status words in `common` above.
      active: "Aktywny",
      expired: "Wygasł",
    },

    permissions: {
      title: "Co możesz robić w WasteSync",
      none: "Nie masz żadnych uprawnień w WasteSync.",
      note:
        "Uprawnienia decydują o tym, co możesz zobaczyć i zmienić w WasteSync. Zarządza nimi Twój administrator w RegulaOne.",
    },

    roles: {
      WASTESYNC_ADMIN: "Administrator WasteSync",
      WASTESYNC_HR_MANAGER: "Menedżer HR WasteSync",
      WASTESYNC_AUDITOR: "Audytor WasteSync",
    },
  },

  access: {
    signedInAs: "Zalogowano jako",
    signOut: "Wyloguj się",

    suspended: {
      eyebrow: "Konto zawieszone",
      title: "Twoje konto zostało wyłączone",
      message:
        "Administrator zawiesił to konto, więc WasteSync jest niedostępny. Skontaktuj się z administratorem, jeśli uważasz, że to pomyłka.",
    },

    moduleUnavailable: {
      eyebrow: "Dostęp ograniczony",
      title: "WasteSync nie jest częścią Twojego planu",
      message:
        "Twoje konto nie obejmuje modułu WasteSync. Skontaktuj się z administratorem, aby dodać WasteSync do subskrypcji Twojej organizacji.",
    },

    planExpired: {
      eyebrow: "Subskrypcja wygasła",
      title: "Twój plan wygasł",
      message:
        "Subskrypcja Twojej organizacji się zakończyła, więc WasteSync jest tymczasowo zablokowany. Skontaktuj się z administratorem, aby odnowić plan i przywrócić dostęp.",
    },

    permissionDenied: {
      eyebrow: "Dostęp ograniczony",
      title: "Nie masz dostępu do WasteSync",
      message:
        "Twoja organizacja korzysta z WasteSync, ale Twoje konto nie otrzymało do niego dostępu. Poproś administratora o nadanie Ci roli w WasteSync.",
    },

    pageNotPermitted: {
      eyebrow: "Poza zakresem Twojej roli",
      title: "Ta strona nie należy do Twojej roli",
      message:
        "Masz dostęp do WasteSync, ale ta konkretna strona jest poza zakresem Twojej roli. Skorzystaj z menu, aby wrócić do stron, na których możesz pracować, lub poproś administratora o szerszy dostęp.",
    },
  },

  notFound: {
    title: "Nie znaleziono strony",
    message: "Strona, której szukasz, nie istnieje.",
    back: "Powrót do pulpitu",
  },
};

export default pl;
