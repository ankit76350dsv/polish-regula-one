/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Official RODO / GDPR criteria lists and billing calculations

export const POLISH_DPIA_CRITERIA = [
  {
    id: 'profiling_scoring',
    code: 'DPIA-PL-01',
    labelEn: 'Evaluation, scoring or profiling',
    labelPl: 'Ewaluacja, ocena lub profilowanie',
    descriptionEn: 'Systematic and extensive evaluation of personal aspects, especially performance at work, economic situation, health, personal preferences.',
    descriptionPl: 'Systematyczna i pomocnicza ocena cech osobowych, zwłaszcza efektów pracy, sytuacji ekonomicznej, zdrowia, osobistych preferencji.'
  },
  {
    id: 'automated_decisions',
    code: 'DPIA-PL-02',
    labelEn: 'Automated decisions with legal/significant effects',
    labelPl: 'Zautomatyzowane decyzje wywołujące skutki prawne',
    descriptionEn: 'Processing that aims at taking decisions which produce legal effects concerning the natural person or similarly significantly affect them.',
    descriptionPl: 'Przetwarzanie służące do podejmowania decyzji wywołujących skutki prawne dla osoby lub istotnie na nią wpływających.'
  },
  {
    id: 'public_monitoring',
    code: 'DPIA-PL-03',
    labelEn: 'Systematic monitoring of public areas on a large scale',
    labelPl: 'Systematyczne monitorowanie miejsc publicznych na dużą skalę',
    descriptionEn: 'Monitoring public areas using physical features recognition, CCTV with AI, beacons, or systematic tracking.',
    descriptionPl: 'Monitorowanie przestrzeni publicznych z użyciem rozpoznawania cech fizycznych, CCTV z AI, beaconów lub śledzenia systemowego.'
  },
  {
    id: 'special_categories',
    code: 'DPIA-PL-04',
    labelEn: 'Special category or criminal conviction data',
    labelPl: 'Dane szczególnej kategorii lub dane o skazaniach',
    descriptionEn: 'Processing of sensitive data under Art 9 (health, biometrics, race) or Art 10 (criminal history) on a large scale.',
    descriptionPl: 'Przetwarzanie na dużą skalę danych wrażliwych z Art. 9 (zdrowie, biometria) lub danych o wyrokach z Art. 10.'
  },
  {
    id: 'biometric_access',
    code: 'DPIA-PL-05',
    labelEn: 'Biometric identification or access control',
    labelPl: 'Identyfikacja biometryczna lub kontrola dostępu',
    descriptionEn: 'Using fingerprint, facial recognition, or iris scanning for access control or identity verification.',
    descriptionPl: 'Wykorzystanie odcisków palców, rozpoznawania twarzy lub skanu tęczówki oka do kontroli dostępu lub weryfikacji tożsamości.'
  },
  {
    id: 'genetic_data',
    code: 'DPIA-PL-06',
    labelEn: 'Genetic data processing',
    labelPl: 'Przetwarzanie danych genetycznych',
    descriptionEn: 'Processing genetic characterizations to identify individuals or assess health risks.',
    descriptionPl: 'Przetwarzanie charakterystyk genetycznych w celu identyfikacji osób lub oceny ryzyka zdrowotnego.'
  },
  {
    id: 'large_scale',
    code: 'DPIA-PL-07',
    labelEn: 'Large-scale processing of personal data',
    labelPl: 'Przetwarzanie danych na dużą skalę',
    descriptionEn: 'Processing matching volume, duration, scope, or geographical boundaries involving millions of operations.',
    descriptionPl: 'Przetwarzanie ze względu na wolumen, czas, zakres lub granice geograficzne dotyczące milionów operacji.'
  },
  {
    id: 'dataset_matching',
    code: 'DPIA-PL-08',
    labelEn: 'Matching or combining datasets',
    labelPl: 'Łączenie lub dopasowywanie zbiorów danych',
    descriptionEn: 'Combining data derived from different processing operations performed for different purposes, beyond reasonable expectations.',
    descriptionPl: 'Łączenie danych pochodzących z różnych operacji realizowanych w różnych celach, poza uzasadnionym oczekiwaniem.'
  },
  {
    id: 'vulnerable_subjects',
    code: 'DPIA-PL-09',
    labelEn: 'Processing involving vulnerable subjects (employees, minors)',
    labelPl: 'Przetwarzanie dotyczące osób wymagających szczególnej opieki (np. pracownicy, dzieci)',
    descriptionEn: 'Power imbalance between data subjects and controller (e.g. employee-employer, patients, students, whistleblowers).',
    descriptionPl: 'Asymetria władzy między osobami a administratorem (np. pracownik-pracodawca, pacjenci, sygnaliści, dzieci).'
  },
  {
    id: 'innovative_tech',
    code: 'DPIA-PL-10',
    labelEn: 'Innovative use or application of technological solutions',
    labelPl: 'Innowacyjne użycie rozwiązań technologicznych',
    descriptionEn: 'Using Internet of Things (IoT), smart meters, beacons, drones, telemedicine, virtual assistants, facial recognition.',
    descriptionPl: 'Zastosowanie Internetu Rzeczy (IoT), inteligentnych liczników, beaconów, dronów, telemedycyny, asystentów VR.'
  },
  {
    id: 'preventing_rights',
    code: 'DPIA-PL-11',
    labelEn: 'Processing preventing subjects from exercising a right/service',
    labelPl: 'Przetwarzanie uniemożliwiające wykonywanie praw lub usług',
    descriptionEn: 'Operations that prevent data subjects from obtaining a service, entering a contract, or exercising a legal right.',
    descriptionPl: 'Operacje, które uniemożliwiają osobom uzyskanie usługi, zawarcie umowy lub wykonywanie praw.'
  },
  {
    id: 'location_data',
    code: 'DPIA-PL-12',
    labelEn: 'Systematic collection of location data',
    labelPl: 'Systematyczne zbieranie danych lokalizacyjnych',
    descriptionEn: 'Real-time monitoring of geographic location or movements via GPS, Wi-Fi networks, mobile apps.',
    descriptionPl: 'Monitorowanie położenia geograficznego lub przemieszczania się w czasie rzeczywistym przez GPS, Wi-Fi, aplikacje.'
  }
];

export const TECHNICAL_ORGANIZATIONAL_MEASURES = [
  { id: 'TOM-01', name: 'Encryption of Personal Data (AES-256) at rest', category: 'Technical' },
  { id: 'TOM-02', name: 'TLS 1.3 Encryption of data in transit', category: 'Technical' },
  { id: 'TOM-03', name: 'Pseudonymization of database records', category: 'Technical' },
  { id: 'TOM-04', name: 'Multi-Factor Authentication (MFA) required for all systems', category: 'Technical' },
  { id: 'TOM-05', name: 'Automated hourly cloud backups with restoration testing', category: 'Technical' },
  { id: 'TOM-06', name: 'Intrusion Detection & Prevention System (IDPS)', category: 'Technical' },
  { id: 'TOM-07', name: 'Role-Based Access Control (RBAC) audit logs', category: 'Technical' },
  { id: 'TOM-08', name: 'Static Code Analysis & automated vulnerability scanning', category: 'Technical' },
  { id: 'TOM-09', name: 'Annual Penetration Testing by certified third-party', category: 'Organizational' },
  { id: 'TOM-10', name: 'Mandatory annual GDPR/RODO training for employees', category: 'Organizational' },
  { id: 'TOM-11', name: 'Signed Data Processing Agreements (DPA) with all vendors', category: 'Organizational' },
  { id: 'TOM-12', name: 'Incident Response Team (IRT) & breach report drills', category: 'Organizational' },
  { id: 'TOM-13', name: 'Clean Desk Policy and hardware lockboxes', category: 'Organizational' },
  { id: 'TOM-14', name: 'Regular audits of subprocessor security compliance', category: 'Organizational' }
];

export const TRANSLATIONS = {
  en: {
    title: 'PrivacyPilot',
    tagline: 'Enterprise Compliance Command',
    dashboard: 'Dashboard',
    ropa: 'ROPA Register',
    dpia: 'DPIA Center',
    risks: 'Risk Register',
    vendors: 'Processors & Vendors',
    transfers: 'International Transfers',
    incidents: 'Breach Logs',
    dsar: 'Data Subject Requests',
    audits: 'Audits & Evidence',
    reports: 'Reports & Analytics',
    tasks: 'Task Center',
    settings: 'Settings',
    superAdmin: 'Super Admin Ops',
    language: 'Language',
    polishTerminology: 'Polish RODO Terms',
    notifications: 'Notifications',
    saveDraft: 'Save Draft',
    autosaved: 'Autosaved',
    completeness: 'Completeness Score',
    missingFields: 'Missing Fields',
    approvals: 'Approvals',
    submitReview: 'Submit for Review',
    status: 'Status',
    action: 'Action',
    export: 'Export',
    search: 'Search command... (Ctrl+K)',
    role: 'Demo Role',
    tenant: 'Tenant',
    disclaimer: 'Draft generated from configured processing records. Requires legal review before publication.',
    
    // ROPA Translations
    ropaTitle: 'Records of Processing Activities',
    ropaSubtitle: 'Rejestr Czynności Przetwarzania (RCP) according to GDPR Article 30',
    controllerTab: 'Controller Records (Art. 30(1))',
    processorTab: 'Processor Records (Art. 30(2))',
    allActivities: 'All Activities',
    newActivity: 'New Processing Activity',
    emptyActivities: 'No processing activities found. Start the wizard to compile your first record.',
    
    // Form fields
    activityName: 'Activity Name',
    department: 'Department',
    owner: 'Owner',
    purpose: 'Purpose of Processing',
    lawfulBasis: 'Lawful Basis (Article 6)',
    specialCategory: 'Special Category Condition (Article 9)',
    dataSubjects: 'Data Subjects',
    dataCategories: 'Data Categories',
    retention: 'Retention Period',
    security: 'Security Measures (TOMs)',
    
    // Polish regulatory texts references
    monitorPolski: 'Monitor Polski 2019 poz. 666 (UODO DPIA List)',
    uodoGuidance: 'UODO Administrator Guidelines (Art. 32-35 RODO)'
  },
  pl: {
    title: 'PrivacyPilot',
    tagline: 'Zarządzanie Zgodnością RODO',
    dashboard: 'Panel Główny',
    ropa: 'Rejestr RCP',
    dpia: 'Analiza DPIA',
    risks: 'Rejestr Ryzyk',
    vendors: 'Procesorzy i Dostawcy',
    transfers: 'Transfery Danych',
    incidents: 'Naruszenia RODO',
    dsar: 'Żądania Podmiotów (DSR)',
    audits: 'Audyty i Dowody',
    reports: 'Raporty i Analizy',
    tasks: 'Centrum Zadań',
    settings: 'Ustawienia',
    superAdmin: 'Panel Super Admina',
    language: 'Język',
    polishTerminology: 'Terminologia RODO',
    notifications: 'Powiadomienia',
    saveDraft: 'Zapisz Szkic',
    autosaved: 'Zapisano automatycznie',
    completeness: 'Stopień Ukończenia',
    missingFields: 'Brakujące Pola',
    approvals: 'Zatwierdzenia',
    submitReview: 'Wyślij do Przeglądu',
    status: 'Status',
    action: 'Akcja',
    export: 'Eksportuj',
    search: 'Szukaj... (Ctrl+K)',
    role: 'Rola Demo',
    tenant: 'Podmiot',
    disclaimer: 'Szkic wygenerowany na podstawie rejestru czynności. Wymaga weryfikacji prawnej przed publikacją.',
    
    // ROPA Translations
    ropaTitle: 'Rejestr Czynności Przetwarzania',
    ropaSubtitle: 'Zgodny z wymogami Art. 30 ust. 1 i 2 RODO (Główny rejestr RCP/RCPP)',
    controllerTab: 'Administrator Danych (Art. 30 ust. 1)',
    processorTab: 'Podmiot Przetwarzający (Art. 30 ust. 2)',
    allActivities: 'Wszystkie Czynności',
    newActivity: 'Nowa Czynność Przetwarzania',
    emptyActivities: 'Nie znaleziono czynności przetwarzania. Uruchom kreator, aby dodać pierwszy wpis.',
    
    // Form fields
    activityName: 'Nazwa Czynności',
    department: 'Dział / Departament',
    owner: 'Właściciel Czynności',
    purpose: 'Cel Przetwarzania',
    lawfulBasis: 'Podstawa Prawna (Artykuł 6 RODO)',
    specialCategory: 'Przesłanka dla Danych Wrażliwych (Artykuł 9 RODO)',
    dataSubjects: 'Kategorie Osób',
    dataCategories: 'Kategorie Danych',
    retention: 'Okres Przechowywania',
    security: 'Środki Techniczne i Organizacyjne (TOM)',
    
    // Polish regulatory texts references
    monitorPolski: 'Monitor Polski 2019 poz. 666 (Wykaz UODO dot. DPIA)',
    uodoGuidance: 'Wytyczne Prezesa UODO (Art. 32-35 RODO)'
  }
};
