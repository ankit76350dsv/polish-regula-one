// GDPR / RODO reference constants used across the app.
// Every list here mirrors the actual legal text so the UI cannot drift from the law.
// Sources: GDPR (OJ L 119, CELEX 32016R0679); UODO ROPA guidance (uodo.gov.pl/pl/383/214);
// EU adequacy list (European Commission, checked 2026-07-02).

// ── Article 6(1) — ALL SIX lawful bases. Frontend A/B both offered only four;
//    that made some real activities impossible to record. Fixed here.
export const ART6_BASES = [
  { id: 'consent',             ref: 'Art. 6(1)(a)', en: 'Consent',                         pl: 'Zgoda osoby, której dane dotyczą' },
  { id: 'contract',            ref: 'Art. 6(1)(b)', en: 'Performance of a contract',       pl: 'Wykonanie umowy' },
  { id: 'legal_obligation',    ref: 'Art. 6(1)(c)', en: 'Legal obligation',                pl: 'Obowiązek prawny administratora' },
  { id: 'vital_interests',     ref: 'Art. 6(1)(d)', en: 'Vital interests',                 pl: 'Ochrona żywotnych interesów' },
  { id: 'public_task',         ref: 'Art. 6(1)(e)', en: 'Public interest / official task', pl: 'Zadanie realizowane w interesie publicznym' },
  { id: 'legitimate_interest', ref: 'Art. 6(1)(f)', en: 'Legitimate interests',            pl: 'Prawnie uzasadniony interes administratora' },
];

// ── Article 9(2) — conditions for processing special-category data.
//    A validated picker, not free text: choosing one is legally required
//    whenever special categories are processed.
export const ART9_CONDITIONS = [
  { id: 'a', ref: 'Art. 9(2)(a)', en: 'Explicit consent',                                    pl: 'Wyraźna zgoda' },
  { id: 'b', ref: 'Art. 9(2)(b)', en: 'Employment / social security law',                    pl: 'Prawo pracy i zabezpieczenia społecznego' },
  { id: 'c', ref: 'Art. 9(2)(c)', en: 'Vital interests (subject incapable of consent)',      pl: 'Żywotne interesy (brak możliwości zgody)' },
  { id: 'd', ref: 'Art. 9(2)(d)', en: 'Foundation / association / non-profit (members)',     pl: 'Fundacje, stowarzyszenia (członkowie)' },
  { id: 'e', ref: 'Art. 9(2)(e)', en: 'Data manifestly made public by the subject',          pl: 'Dane upublicznione przez osobę' },
  { id: 'f', ref: 'Art. 9(2)(f)', en: 'Legal claims / courts acting judicially',             pl: 'Dochodzenie roszczeń / wymiar sprawiedliwości' },
  { id: 'g', ref: 'Art. 9(2)(g)', en: 'Substantial public interest (EU/Member State law)',   pl: 'Ważny interes publiczny (prawo UE/państwa)' },
  { id: 'h', ref: 'Art. 9(2)(h)', en: 'Health care / occupational medicine',                 pl: 'Opieka zdrowotna / medycyna pracy' },
  { id: 'i', ref: 'Art. 9(2)(i)', en: 'Public health',                                      pl: 'Zdrowie publiczne' },
  { id: 'j', ref: 'Art. 9(2)(j)', en: 'Archiving / research / statistics (Art. 89(1))',      pl: 'Archiwizacja / badania naukowe / statystyka' },
];

// ── Special categories per Art. 9(1). Kept as an explicit list so the wizard can
//    flag them correctly. NOTE: children's data (Art. 8) and location data are NOT
//    Art. 9 categories — Frontend A wrongly labelled them as such.
export const SPECIAL_CATEGORY_IDS = [
  'health', 'biometric_id', 'genetic', 'racial_ethnic', 'political',
  'religious', 'trade_union', 'sex_life', 'sexual_orientation',
];

export const DATA_CATEGORIES = [
  { id: 'identity',           en: 'Identification data (name, PESEL, ID no.)', pl: 'Dane identyfikacyjne (imię, nazwisko, PESEL)' },
  { id: 'contact',            en: 'Contact details (email, phone, address)',   pl: 'Dane kontaktowe (e-mail, telefon, adres)' },
  { id: 'financial',          en: 'Financial data (salary, bank account)',     pl: 'Dane finansowe (wynagrodzenie, nr konta)' },
  { id: 'employment',         en: 'Employment data (contract, evaluations)',   pl: 'Dane kadrowe (umowa, oceny)' },
  { id: 'image_cctv',         en: 'Image / CCTV footage',                      pl: 'Wizerunek / monitoring wizyjny' },
  { id: 'location',           en: 'Location data',                             pl: 'Dane lokalizacyjne' },
  { id: 'online_identifiers', en: 'Online identifiers (IP, cookies)',          pl: 'Identyfikatory internetowe (IP, cookies)' },
  { id: 'children',           en: "Children's data (Art. 8)",                  pl: 'Dane dzieci (art. 8)' },
  // Art. 9(1) special categories. All nine are selectable so any activity that
  // processes them can be represented in the ROPA (previously only four existed,
  // making e.g. religious or trade-related special data impossible to record).
  { id: 'health',             en: 'Health data (Art. 9)',                      pl: 'Dane o zdrowiu (art. 9)', special: true },
  { id: 'biometric_id',       en: 'Biometric data for identification (Art. 9)', pl: 'Dane biometryczne do identyfikacji (art. 9)', special: true },
  { id: 'genetic',            en: 'Genetic data (Art. 9)',                     pl: 'Dane genetyczne (art. 9)', special: true },
  { id: 'racial_ethnic',      en: 'Racial or ethnic origin (Art. 9)',          pl: 'Pochodzenie rasowe lub etniczne (art. 9)', special: true },
  { id: 'political',          en: 'Political opinions (Art. 9)',               pl: 'Poglądy polityczne (art. 9)', special: true },
  { id: 'religious',          en: 'Religious or philosophical beliefs (Art. 9)', pl: 'Przekonania religijne lub światopoglądowe (art. 9)', special: true },
  { id: 'trade_union',        en: 'Trade union membership (Art. 9)',           pl: 'Przynależność związkowa (art. 9)', special: true },
  { id: 'sex_life',           en: 'Data concerning sex life (Art. 9)',         pl: 'Dane dotyczące życia seksualnego (art. 9)', special: true },
  { id: 'sexual_orientation', en: 'Sexual orientation (Art. 9)',               pl: 'Orientacja seksualna (art. 9)', special: true },
  { id: 'criminal',           en: 'Criminal convictions / offences (Art. 10)', pl: 'Dane o wyrokach i naruszeniach (art. 10)', art10: true },
];

export const DATA_SUBJECT_CATEGORIES = [
  { id: 'employees',      en: 'Employees',            pl: 'Pracownicy' },
  { id: 'candidates',     en: 'Job candidates',       pl: 'Kandydaci do pracy' },
  { id: 'contractors',    en: 'Contractors (B2B)',    pl: 'Współpracownicy (B2B)' },
  { id: 'customers',      en: 'Customers',            pl: 'Klienci' },
  { id: 'suppliers',      en: 'Supplier contacts',    pl: 'Kontakty dostawców' },
  { id: 'website_users',  en: 'Website users',        pl: 'Użytkownicy strony' },
  { id: 'patients',       en: 'Patients',             pl: 'Pacjenci' },
  { id: 'whistleblowers', en: 'Whistleblowers',       pl: 'Sygnaliści' },
  { id: 'visitors',       en: 'Visitors (premises)',  pl: 'Osoby odwiedzające' },
];

// ── Art. 30(1)(d) recipients are NOT the same thing as Art. 28 processors.
//    Both prototypes conflated them; we keep two separate fields.
export const RECIPIENT_CATEGORIES = [
  { id: 'public_authorities', en: 'Public authorities (ZUS, US, UODO)',  pl: 'Organy publiczne (ZUS, US, UODO)' },
  { id: 'banks',              en: 'Banks / payment institutions',        pl: 'Banki / instytucje płatnicze' },
  { id: 'it_providers',       en: 'IT service providers',                pl: 'Dostawcy usług IT' },
  { id: 'payroll_bureau',     en: 'Payroll / accounting bureau',         pl: 'Biuro rachunkowe / kadrowo-płacowe' },
  { id: 'legal_advisors',     en: 'Legal advisors',                      pl: 'Kancelarie prawne' },
  { id: 'medical_providers',  en: 'Occupational medicine providers',     pl: 'Medycyna pracy' },
  { id: 'insurers',           en: 'Insurers',                            pl: 'Ubezpieczyciele' },
  { id: 'couriers',           en: 'Postal / courier operators',          pl: 'Operatorzy pocztowi / kurierzy' },
  { id: 'group_companies',    en: 'Group companies',                     pl: 'Spółki z grupy kapitałowej' },
];

// ── Chapter V transfer mechanisms. Destination country is captured separately —
//    Art. 30(1)(e) requires identifying the third country.
export const TRANSFER_MECHANISMS = [
  { id: 'adequacy',  ref: 'Art. 45',      en: 'Adequacy decision',                         pl: 'Decyzja o adekwatności' },
  { id: 'scc',       ref: 'Art. 46(2)(c)', en: 'Standard Contractual Clauses (2021/914)',   pl: 'Standardowe klauzule umowne (2021/914)' },
  { id: 'bcr',       ref: 'Art. 47',      en: 'Binding Corporate Rules',                   pl: 'Wiążące reguły korporacyjne' },
  { id: 'derogation', ref: 'Art. 49',     en: 'Art. 49 derogation (documented)',           pl: 'Wyjątek z art. 49 (udokumentowany)' },
];

// EU Commission adequacy list, checked 2026-07-02 (commission.europa.eu → adequacy decisions).
export const ADEQUACY_COUNTRIES = [
  'Andorra', 'Argentina', 'Brazil', 'Canada (commercial)', 'Faroe Islands', 'Guernsey',
  'Israel', 'Isle of Man', 'Japan', 'Jersey', 'New Zealand', 'Republic of Korea',
  'Switzerland', 'United Kingdom', 'USA (DPF participants only)', 'Uruguay',
];

// ── Art. 32(1) technical and organisational measures (curated list from the
//    frontend2 prototype, kept — it matched UODO template expectations well).
export const TOMS = [
  { id: 'tom_encryption_rest',   en: 'Encryption at rest (AES-256)',              pl: 'Szyfrowanie danych w spoczynku (AES-256)' },
  { id: 'tom_encryption_transit', en: 'Encryption in transit (TLS 1.3)',          pl: 'Szyfrowanie transmisji (TLS 1.3)' },
  { id: 'tom_pseudonymisation',  en: 'Pseudonymisation',                          pl: 'Pseudonimizacja' },
  { id: 'tom_access_control',    en: 'Role-based access control',                 pl: 'Kontrola dostępu oparta na rolach' },
  { id: 'tom_mfa',               en: 'Multi-factor authentication',               pl: 'Uwierzytelnianie wieloskładnikowe' },
  { id: 'tom_backups',           en: 'Regular encrypted backups',                 pl: 'Regularne szyfrowane kopie zapasowe' },
  { id: 'tom_logging',           en: 'Access logging and monitoring',             pl: 'Rejestrowanie i monitorowanie dostępu' },
  { id: 'tom_dpa_contracts',     en: 'Signed DPAs with all processors (Art. 28)', pl: 'Umowy powierzenia ze wszystkimi podmiotami (art. 28)' },
  { id: 'tom_training',          en: 'Staff data-protection training',            pl: 'Szkolenia pracowników z ochrony danych' },
  { id: 'tom_clean_desk',        en: 'Clean desk / physical security policy',     pl: 'Polityka czystego biurka / ochrona fizyczna' },
  { id: 'tom_incident_procedure', en: 'Incident response procedure',              pl: 'Procedura reagowania na incydenty' },
  { id: 'tom_retention_automation', en: 'Automated retention enforcement',        pl: 'Automatyczne egzekwowanie retencji' },
  { id: 'tom_vulnerability',     en: 'Vulnerability management / pentesting',     pl: 'Zarządzanie podatnościami / testy penetracyjne' },
  { id: 'tom_anonymisation',     en: 'Anonymisation of analytics data',           pl: 'Anonimizacja danych analitycznych' },
];

// ── DSAR request types (Arts. 15–22). Complaints and consent withdrawal are
//    routed separately — they are not Chapter III rights requests.
export const DSAR_TYPES = [
  { id: 'access',        ref: 'Art. 15', en: 'Access / copy of data', pl: 'Dostęp / kopia danych' },
  { id: 'rectification', ref: 'Art. 16', en: 'Rectification',         pl: 'Sprostowanie' },
  { id: 'erasure',       ref: 'Art. 17', en: 'Erasure',               pl: 'Usunięcie danych' },
  { id: 'restriction',   ref: 'Art. 18', en: 'Restriction',           pl: 'Ograniczenie przetwarzania' },
  { id: 'portability',   ref: 'Art. 20', en: 'Data portability',      pl: 'Przenoszenie danych' },
  { id: 'objection',     ref: 'Art. 21', en: 'Objection',             pl: 'Sprzeciw' },
];

// ── Notice audiences (Arts. 13/14 are per-context, not one "privacy policy").
export const NOTICE_AUDIENCES = [
  { id: 'website',        art: 13, en: 'Website users',    pl: 'Użytkownicy strony internetowej' },
  { id: 'employees',      art: 13, en: 'Employees',        pl: 'Pracownicy' },
  { id: 'candidates',     art: 13, en: 'Job candidates',   pl: 'Kandydaci do pracy' },
  { id: 'contractors',    art: 13, en: 'Contractors',      pl: 'Kontrahenci' },
  { id: 'whistleblowers', art: 14, en: 'Whistleblowers',   pl: 'Sygnaliści' },
];

// ── Art. 13(1)–(2) / Art. 14(1)–(2) completeness checklist. The notice generator
//    is BLOCKED until every mandatory item can be filled from register data.
export const NOTICE_REQUIRED_ITEMS = [
  { id: 'controller_identity', ref: 'Art. 13(1)(a) / 14(1)(a)', en: 'Controller identity and contact details', pl: 'Tożsamość i dane kontaktowe administratora' },
  { id: 'dpo_contact',         ref: 'Art. 13(1)(b) / 14(1)(b)', en: 'DPO contact details',                     pl: 'Dane kontaktowe IOD' },
  { id: 'purposes_basis',      ref: 'Art. 13(1)(c) / 14(1)(c)', en: 'Purposes and legal basis',                pl: 'Cele i podstawa prawna' },
  // Art. 14(1)(d): where data is NOT obtained from the subject, the categories of
  // personal data must be disclosed (the subject can't know what was collected).
  { id: 'data_categories',     ref: 'Art. 14(1)(d)',            en: 'Categories of personal data (Art. 14 notices only)', pl: 'Kategorie danych osobowych (tylko notice z art. 14)', art14Only: true },
  { id: 'legitimate_interest', ref: 'Art. 13(1)(d)',            en: 'Legitimate interests (if Art. 6(1)(f))',  pl: 'Prawnie uzasadnione interesy (jeśli art. 6(1)(f))', conditional: true },
  { id: 'recipients',          ref: 'Art. 13(1)(e) / 14(1)(e)', en: 'Recipients or categories of recipients',  pl: 'Odbiorcy lub kategorie odbiorców' },
  { id: 'transfers',           ref: 'Art. 13(1)(f) / 14(1)(f)', en: 'Third-country transfers and safeguards',  pl: 'Przekazywanie do państw trzecich i zabezpieczenia', conditional: true },
  { id: 'retention',           ref: 'Art. 13(2)(a) / 14(2)(a)', en: 'Retention period or criteria',            pl: 'Okres przechowywania lub kryteria' },
  { id: 'rights',              ref: 'Art. 13(2)(b) / 14(2)(c)', en: 'Data subject rights (Arts. 15–21)',       pl: 'Prawa osoby (art. 15–21)' },
  { id: 'withdraw_consent',    ref: 'Art. 13(2)(c) / 14(2)(d)', en: 'Right to withdraw consent (Art. 7(3))',   pl: 'Prawo cofnięcia zgody (art. 7(3))', conditional: true },
  { id: 'complaint',           ref: 'Art. 13(2)(d) / 14(2)(e)', en: 'Right to complain to UODO',               pl: 'Prawo skargi do Prezesa UODO' },
  // Art. 13(2)(e) applies only to data collected FROM the subject — i.e. Art. 13
  // notices. It is not a mandatory element of an Art. 14 notice, so it is gated
  // to Art. 13 audiences instead of being required for everyone.
  { id: 'provision_requirement', ref: 'Art. 13(2)(e)',          en: 'Whether provision is statutory/contractual + consequences', pl: 'Czy podanie danych jest wymogiem + konsekwencje', art13Only: true },
  { id: 'source',              ref: 'Art. 14(2)(f)',            en: 'Source of the data (Art. 14 notices only)', pl: 'Źródło danych (tylko notice z art. 14)', art14Only: true },
  { id: 'automated_decisions', ref: 'Art. 13(2)(f) / 14(2)(g)', en: 'Automated decision-making incl. profiling', pl: 'Zautomatyzowane decyzje, w tym profilowanie', conditional: true },
];

export const DEPARTMENTS = [
  { id: 'hr',         en: 'HR',              pl: 'Kadry (HR)' },
  { id: 'finance',    en: 'Finance',         pl: 'Finanse' },
  { id: 'it',         en: 'IT',              pl: 'IT' },
  { id: 'marketing',  en: 'Marketing',       pl: 'Marketing' },
  { id: 'sales',      en: 'Sales',           pl: 'Sprzedaż' },
  { id: 'operations', en: 'Operations',      pl: 'Operacje' },
  { id: 'legal',      en: 'Legal',           pl: 'Dział prawny' },
  { id: 'security',   en: 'Security',        pl: 'Ochrona' },
];

// Small helpers used everywhere.
export const byId = (list, id) => list.find((x) => x.id === id);
export const labelOf = (list, id, lang) => byId(list, id)?.[lang] ?? id;
