// English wording for every screen in WasteSync.
//
// This file is the reference list of keys. The Polish file (pl.js) has exactly
// the same keys with Polish wording. When you add a new word, add it to BOTH
// files — if a key is missing from Polish, the app quietly shows the English
// wording instead of an empty space (see hooks/useTranslation.js).
//
// Keys are grouped by screen so they are easy to find:
//   common       -> small words used everywhere (Save, Cancel, Year, Total)
//   language     -> the PL / EN switch in the header
//   nav/footer   -> the header menu and the page footer
//   auth         -> the sign-in / SSO waiting screens
//   months       -> the twelve month names
//   categories   -> the five waste categories
//   dashboard    -> the reporting overview page
//   filing       -> the 15 March BDO deadline banner on the dashboard
//   wasteEntries -> the monthly waste figures page
//   reports      -> the annual reports list
//   reportDetail -> one annual report
//   thresholds   -> the legal limits page
//   audit        -> the audit log page
//   company      -> the company profile page
//   access       -> the "you cannot use this" screens
//   notFound     -> the wrong-address page
//
// {{name}} inside a sentence is a placeholder that the code fills in. Each
// language decides where its own placeholder sits, because Polish and English
// do not always put the number in the same place.

const en = {
  common: {
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    clear: "Clear",
    open: "Open",
    view: "View",
    change: "Change",
    previous: "Previous",
    next: "Next",
    year: "Year",
    month: "Month",
    total: "Total",
    status: "Status",
    actions: "Actions",
    category: "Category",
    loading: "Loading…",
    notSet: "Not set",
    active: "Active",
    inactive: "Inactive",
    expired: "Expired",
    none: "None",
    kg: "kg",
    // A single dash, shown where a value is missing so the row still lines up.
    empty: "—",
  },

  language: {
    label: "Language",
    polish: "Polish",
    english: "English",
    switchTo: "Switch to {{language}}",
  },

  nav: {
    brandTagline: "BDO Reporting",
    dashboard: "Dashboard",
    company: "Company",
    wasteEntries: "Waste Entries",
    reports: "Reports",
    thresholds: "Thresholds",
    auditLogs: "Audit Logs",
    signedIn: "Signed in",
    logOut: "Log out",
  },

  footer: {
    copyright: "© {{year}} DSV Corporation — WasteSync (RegulaOne platform)",
    tagline: "BDO Waste & Packaging Reporting · Poland / EEA",
  },

  auth: {
    redirecting: "Redirecting to RegulaOne login…",
    returnAfterSignIn: "You will be returned to WasteSync automatically after signing in.",
    verifying: "Verifying session…",
  },

  // Month names. Used in the form dropdown, the 12-month table and the charts.
  // The charts shorten these to the first three letters, which reads correctly in
  // both languages.
  months: {
    1: "January",
    2: "February",
    3: "March",
    4: "April",
    5: "May",
    6: "June",
    7: "July",
    8: "August",
    9: "September",
    10: "October",
    11: "November",
    12: "December",
  },

  // The five kinds of packaging waste. The KEYS must stay exactly as they are —
  // they are the codes the backend and the BDO XML use. Only the wording here is
  // translated.
  categories: {
    PAPER: "Paper & cardboard",
    PLASTIC: "Plastic",
    GLASS: "Glass",
    METAL: "Metal",
    MIXED: "Mixed / multi-material",
  },

  dashboard: {
    eyebrow: "WasteSync · BDO Reporting",
    title: "Dashboard",
    loading: "Loading dashboard…",
    // Shown under the title. The company name version is used when RegulaOne
    // could be reached; the plain one when it could not.
    subtitle: "Reporting overview for {{year}}",
    subtitleWithCompany: "{{company}} · Reporting overview for {{year}}",

    metrics: {
      entriesThisYear: "Entries this year",
      reportsGenerated: "Reports generated",
      missingMonths: "Missing months",
      totalWaste: "Total waste (kg)",
      needsAttention: "Needs attention",
      allCaughtUp: "All caught up",
    },

    charts: {
      byCategory: "Waste by category (kg)",
      monthlyTrend: "Monthly trend (kg)",
    },

    alerts: {
      title: "Compliance alerts",
      none: "No issues — everything looks good.",
    },

    reportingStatus: {
      title: "Reporting status ({{year}})",
      nothingYet: "Nothing to report on yet.",
      yourCompany: "Your company",
      noBdoNumber: "No BDO number set",
      reported: "Reported",
      notReported: "Not reported",
    },

    recentReports: {
      title: "Recent reports",
      viewAll: "View all",
      none: "No reports generated yet.",
    },

    recentActivity: {
      title: "Recent activity",
      viewAuditLog: "View audit log",
      none: "No activity yet.",
    },
  },

  // The 15 March filing deadline banner. Every sentence here is about a legal
  // date, so the wording is deliberately plain and never hopeful.
  filing: {
    overdueTitle: "The {{year}} report is overdue",
    overdueGenerated:
      "It was due on {{date}} ({{days}} days ago). The report has been generated but not yet marked as submitted to the BDO portal.",
    overdueNotGenerated:
      "It was due on {{date}} ({{days}} days ago) and has not been generated yet.",
    filedTitle: "The {{year}} report has been filed",
    filedDetail: "Nothing outstanding. The next report is due {{date}}.",
    // Two forms because "1 day" and "5 days" differ in both languages.
    dueSoonTitleOne: "The {{year}} report is due in 1 day",
    dueSoonTitle: "The {{year}} report is due in {{days}} days",
    dueSoonDetail: "It must be filed in the BDO portal by {{date}}.",
    dueSoonGeneratedSuffix: " It has been generated — mark it submitted once it is filed.",
    nextTitle: "Next BDO report: {{year}}",
    nextDetail: "Due {{date}} — {{days}} days away.",
    predatesAccount:
      " Earlier years are not shown because they are from before this account was set up — check them directly in the BDO portal if you need to.",
    annualFee:
      "Separately, the annual register fee (opłata roczna) is due by {{date}}. WasteSync does not track payments.",
    goToReports: "Go to reports",
  },

  wasteEntries: {
    eyebrow: "WasteSync · Monthly records",
    title: "Waste Entries",
    subtitleWrite:
      "Record monthly packaging waste. Saved data is never overwritten — corrections create a new version.",
    subtitleRead:
      "Monthly packaging waste figures, including every past version of each month.",
    monthsRecorded: "Months recorded",
    loading: "Loading entries…",

    metrics: {
      totalYear: "Total {{year}} (kg)",
      monthsRecorded: "Months recorded",
      pctOfYear: "{{pct}}% of the year",
      notRecordedYet: "Not recorded yet",
      fullYearCaptured: "Full year captured",
      monthsStillBlank: "Months still blank",
      largestCategory: "Largest category",
      noFiguresYet: "No figures yet",
    },

    form: {
      title: "Record / correct a month",
      hint: "a correction is saved as a new version, nothing is overwritten",
      currentVersion: "Current version: v{{version}}",
      notRecordedYet: "Not recorded yet",
      stillBlank: "Still blank",
      // Read out by screen readers for each weight box.
      kgAriaLabel: "{{category}} in kilograms",
      notes: "Notes (optional)",
      notesPlaceholder: "e.g. corrected after invoice review",
      save: "Save month",
      savingHint: "Saving {{month}} {{year}}",
    },

    table: {
      title: "{{year}} monthly figures",
      hint: "{{count}} of 12 months",
      allWeightsInKg: "All weights in kilograms",
      history: "History",
      yearTotal: "Year total",
      recorded: "Recorded",
      corrected: "Corrected · v{{version}}",
      blank: "Blank",
    },

    history: {
      title: "{{month}} {{year}} version history",
      subtitle: "Every version ever saved for this month",
      close: "Close version history",
      loading: "Loading history…",
      none: "No history found.",
      current: "(current)",
      total: "Total: {{kg}} kg",
    },
  },

  reports: {
    title: "Annual Reports",
    subtitleGenerate: "Generate BDO annual reports (XML for the portal + PDF for your records).",
    subtitleRead:
      "BDO annual reports. Open one to see its figures and download the XML or PDF.",
    generate: "Generate report",
    generating: "Generating…",
    loading: "Loading reports…",
    emptyTitle: "No reports yet",
    emptyMessageGenerate: "Choose a year above, then generate your first annual report.",
    emptyMessageRead:
      "No annual reports have been generated yet, so there is nothing to review here.",

    table: {
      company: "Company",
      bdoNumber: "BDO number",
      totalKg: "Total (kg)",
      compliance: "Compliance",
      version: "Version",
    },

    passed: "Passed",
    breach: "Breach",
    submitted: "Submitted",
    generated: "Generated",
  },

  reportDetail: {
    title: "Annual Report — {{year}}",
    subtitle: "{{company}} · BDO {{bdo}}",
    loading: "Loading report…",
    downloadXml: "Download XML",
    downloadPdf: "Download PDF",
    markSubmitted: "Mark submitted",
    downloadError: "Could not get the {{format}} download link",
    version: "Version {{version}}",
    submittedToBdo: "Submitted to BDO",
    generated: "Generated",
    thresholdsNotEvaluated: "Thresholds not evaluated",
    thresholdsPassed: "Thresholds passed",
    thresholdBreach: "Threshold breach",
    notFiledNotice:
      "This report has been generated but is not yet marked as filed with BDO. Only an administrator can confirm the filing.",
    noThresholdsNotice:
      "No legal thresholds are configured for {{year}}, so the totals were not checked against any limit. Set the limits on the Thresholds page to make this check meaningful.",
    breachesTitle: "Legal threshold issues:",
    missingMonths: "No data was recorded for: {{months}}.",
    totalsTitle: "Yearly totals by category",
    grandTotal: "Grand total",
    detailsTitle: "Report details",
    reportingYear: "Reporting year",
    bdoNumber: "BDO number",
    generatedAt: "Generated",
    backToReports: "← Back to reports",
  },

  thresholds: {
    title: "Legal Thresholds",
    subtitle: "Set the BDO legal limits each annual report is checked against.",
    readOnlyNotice:
      "You can view the configured limits, but only an administrator can change them.",
    hint:
      "Values are in kilograms (kg). Leave a box empty to set no limit for that category. The legal maximum cannot be lower than the reporting threshold.",
    loading: "Loading thresholds…",
    reportingThreshold: "Reporting threshold (kg)",
    legalMaximum: "Legal maximum (kg)",
    configured: "Configured",
    savedNotice: "Saved the limit for {{category}} ({{year}}).",
    removedNotice: "Removed the limit for {{category}} ({{year}}).",
    loadError: "Could not load thresholds",
    saveError: "Could not save the limit for {{category}}",
    removeError: "Could not remove the limit for {{category}}",
  },

  audit: {
    title: "Audit Logs",
    subtitle:
      "Every important action is recorded here. Records are immutable and kept for 10 years.",
    filterLabel: "Action",
    allActions: "All actions",
    loading: "Loading audit logs…",
    none: "No audit records found.",
    pagination: "Page {{page}} of {{totalPages}} · {{total}} records",

    table: {
      when: "When",
      action: "Action",
      user: "User",
      resource: "Resource",
      ip: "IP",
    },

    // Friendly wording for the action codes in the filter dropdown. The codes
    // themselves are never translated in the table — an audit record must read the
    // same for an inspector whatever language the screen is in.
    actionNames: {
      LOGIN: "Signed in",
      LOGOUT: "Signed out",
      COMPANY_CREATED: "Company created",
      COMPANY_UPDATED: "Company updated",
      WASTE_ENTRY_CREATED: "Waste entry recorded",
      WASTE_ENTRY_CORRECTED: "Waste entry corrected",
      REPORT_GENERATED: "Report generated",
      REPORT_DOWNLOADED: "Report downloaded",
      REPORT_SUBMITTED: "Report submitted",
      ACCESS_DENIED: "Access refused",
    },
  },

  company: {
    title: "Company",
    subtitle:
      "Your company details come from RegulaOne. Change them there and they update here automatically.",
    loading: "Loading your company…",
    bdoMissingWrite:
      "Add your 9-digit BDO registration number below. Reports cannot be generated without it.",
    bdoMissingRead:
      "This company has no BDO registration number yet. Someone who manages company records needs to add it before reports can be generated.",
    bdoBadge: "BDO {{number}}",
    noBdoNumber: "No BDO number",
    managedInRegulaOne: "Managed in RegulaOne",
    footnote:
      "Company details are read from RegulaOne each time this page opens. WasteSync keeps no copy of them, so what you see is always current.",

    identity: {
      title: "Company identity",
      name: "Company name",
      nip: "NIP (tax number)",
      regon: "REGON",
      registeredOn: "Registered on",
    },

    contact: {
      title: "Contact",
      email: "E-mail",
      phone: "Phone",
    },

    address: {
      title: "Registered address",
      street: "Street",
      postalCode: "Postal code",
      city: "City",
      country: "Country",
    },

    bdo: {
      title: "BDO registration number",
      addNumber: "Add number",
      description:
        "The 9-digit number from the Polish BDO register. It is printed on every report, and RegulaOne does not store it, so it is set here.",
      save: "Save number",
      notSetYet: "Not set yet",
      invalid: "The BDO number must be exactly 9 digits.",
    },

    subscription: {
      title: "Subscription",
      planStatus: "Plan status",
      planExpires: "Plan expires",
      enabledModules: "Enabled modules",
      // The plan has its own "active"/"expired" words rather than reusing the ones
      // in `common`. In Polish those two words change ending depending on what they
      // describe: a company (firma) and a plan take different forms, so sharing one
      // key would make one of the two screens read wrong.
      active: "Active",
      expired: "Expired",
    },

    permissions: {
      title: "What you can do in WasteSync",
      none: "You have no WasteSync permissions.",
      note:
        "Permissions decide what you can see and change in WasteSync. They are managed by your administrator in RegulaOne.",
    },

    // The WasteSync job titles. Codes we do not recognise are shown exactly as
    // they arrived, so a new role never disappears from the screen by accident.
    roles: {
      WASTESYNC_ADMIN: "WasteSync Admin",
      WASTESYNC_HR_MANAGER: "WasteSync HR Manager",
      WASTESYNC_AUDITOR: "WasteSync Auditor",
    },
  },

  access: {
    signedInAs: "Signed in as",
    signOut: "Sign out",

    suspended: {
      eyebrow: "Account Suspended",
      title: "Your account has been switched off",
      message:
        "An administrator has suspended this account, so WasteSync is not available. Please contact your administrator if you think this is a mistake.",
    },

    moduleUnavailable: {
      eyebrow: "Access Restricted",
      title: "WasteSync is not part of your plan",
      message:
        "Your account does not include the WasteSync module. Please contact your administrator to have WasteSync added to your organisation's subscription.",
    },

    planExpired: {
      eyebrow: "Subscription Expired",
      title: "Your plan has expired",
      message:
        "Your organisation's subscription has ended, so WasteSync is temporarily locked. Please contact your administrator to renew the plan and restore access.",
    },

    permissionDenied: {
      eyebrow: "Access Restricted",
      title: "You do not have access to WasteSync",
      message:
        "Your organisation uses WasteSync, but your account has not been given access to it. Please ask your administrator to grant you a WasteSync role.",
    },

    pageNotPermitted: {
      eyebrow: "Not Part Of Your Role",
      title: "This page is not part of your role",
      message:
        "You have WasteSync access, but this particular page is outside what your role covers. Use the menu to go back to the pages you can work with, or ask your administrator if you need more access.",
    },
  },

  notFound: {
    title: "Page not found",
    message: "The page you were looking for does not exist.",
    back: "Back to dashboard",
  },
};

export default en;
