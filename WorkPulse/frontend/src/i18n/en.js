// English wording for the whole WorkPulse app.
//
// Polish (pl.js) is the DEFAULT language because WorkPulse is built for the
// Polish market. English is the second option and ALSO the fallback: if a Polish
// word is ever missing, the app shows the English one instead of an empty space
// (see hooks/useTranslation.js).
//
// HOW TO ADD TEXT
//   1. Add the key here, in the group for that screen.
//   2. Add the same key to pl.js.
//   3. Use it in the component with t("group.key").
//
// Sentences that need a number or a name in the middle use a {{placeholder}}.
// Each language decides where its own placeholder goes, because Polish and
// English do not always put the number in the same place.

const en = {
  // ── Words used on many screens ─────────────────────────────────────────────
  common: {
    loading: "Loading…",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    close: "Close",
    previous: "Previous",
    next: "Next",
    signIn: "Sign In",
    signOut: "Sign Out",
    employee: "Employee",
    date: "Date",
    from: "From",
    to: "To",
    days: "Days",
    status: "Status",
    actions: "Actions",
    reason: "Reason",
    type: "Type",
    worked: "Worked",
    break: "Break",
    overtime: "Overtime",
    in: "In",
    out: "Out",
    approve: "Approve",
    reject: "Reject",
    ok: "OK",
    blocked: "Blocked",
    none: "—",
    pleaseWait: "Please wait…",
    viewOnly: "View only",
    // Short units used by the duration formatter, e.g. "8h 30m".
    hourShort: "h",
    minuteShort: "m",
    // Short unit for a number of minutes on its own, e.g. "Required: 15m".
    minutesShort: "{{count}}m",
    hoursSuffix: "{{count}}h",
  },

  // ── The PL / EN switch in the header ──────────────────────────────────────
  language: {
    label: "Language",
    polish: "Polish",
    english: "English",
    switchTo: "Switch to {{language}}",
  },

  // ── Header / navigation ───────────────────────────────────────────────────
  //
  // Keep these SHORT — they have to fit eight across one row. The full name of
  // each screen lives in its own group below (records.title, settlement.title,
  // timesheet.title) and is what the page heading and the menu tooltip show.
  // See the same note in pl.js, where the difference really matters.
  nav: {
    clock: "Clock",
    myTimesheet: "My Timesheet",
    absences: "Absences",
    timeRecords: "Time Records",
    dashboard: "Dashboard",
    settlement: "Settlement",
    policy: "Policy",
    audit: "Audit",
    tagline: "Poland · Working Time",
    toggleMenu: "Toggle menu",
  },

  footer: {
    rights: "© 2026 WorkPulse Poland. All rights reserved.",
    tagline: "Working-time evidence · Kodeks pracy",
  },

  // ── Break-compliance labels (art. 134) ────────────────────────────────────
  breakStatus: {
    compliant: "Break OK",
    short: "Short break",
    missing: "Missing break",
    notNeeded: "No break needed",
  },

  // ── Time-entry lifecycle labels ───────────────────────────────────────────
  entryStatus: {
    open: "Working",
    onBreak: "On break",
    completed: "Completed",
    missingClockOut: "Missing clock-out",
    autoClosed: "Auto-closed",
  },

  // ── Absence types. The Polish legal name is kept in brackets in English,
  //    because that is the term that appears on the paperwork. ──────────────
  absenceType: {
    ANNUAL_LEAVE: "Annual leave (urlop wypoczynkowy)",
    ON_DEMAND_LEAVE: "On-demand leave (urlop na żądanie)",
    SICK_LEAVE: "Sick leave (L4)",
    UNPAID_LEAVE: "Unpaid leave (urlop bezpłatny)",
    MATERNITY_LEAVE: "Maternity/parental (macierzyński)",
    CHILDCARE_LEAVE: "Childcare (wychowawczy)",
    SPECIAL_LEAVE: "Special leave (okolicznościowy)",
    PUBLIC_HOLIDAY: "Public holiday",
    OTHER: "Other",
  },

  // ── Absence request decision states ───────────────────────────────────────
  absenceStatus: {
    PENDING: "Pending",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
  },

  // ── The Clock screen ──────────────────────────────────────────────────────
  clock: {
    loading: "Loading your clock…",
    cannotClockIn: "You cannot clock in",
    safeWorkNote:
      "This check comes from your SafeWork compliance record (medical certificate / BHP training). Please contact your administrator.",
    welcomeBack: "Welcome back",
    welcomeBackNamed: "Welcome back, {{name}}",
    dailyNorm: "Daily norm: {{hours}}h · {{system}} system",
    clockIn: "Clock In",
    complianceUpToDate: "✓ Your safety & medical compliance is up to date",
    locationWillBeRecorded:
      "📍 Your location will be recorded for this clock-in (you accepted the monitoring notice).",

    monitoringTitle: "Location monitoring notice",
    monitoringSubtitle:
      "Required by art. 22² of the Polish Labour Code · notice v{{version}}",
    monitoringAccept: "I understand and accept",

    working: "Working",
    onBreak: "On break",
    since: "since {{time}}",
    workedSoFar: "Worked so far",
    onBreakFor: "On break for {{duration}}",
    startBreak: "Start Break",
    endBreak: "End Break",
    clockOut: "Clock Out",

    breakTaken: "Break taken",
    breakRequired: "Required: {{minutes}}",
    breakStatusTitle: "Break status",
    breakNotRequiredYet: "Not required yet",
    breakCompliant: "Compliant",
    breakDue: "Break due",
    breakRule: "6h → 15m · 9h → 30m",
    overtimeSoFar: "Overtime so far",
    normLabel: "Norm: {{duration}}",
  },

  // ── My Timesheet ──────────────────────────────────────────────────────────
  timesheet: {
    title: "My Timesheet",
    subtitle: "Your recorded working time and breaks",
    daysShown: "Days shown",
    totalWorked: "Total worked",
    totalOvertime: "Total overtime",
    empty: "No time entries yet. Clock in from the Clock screen to start.",
    pendingSuffix: " (pending)",

    myCompliance: "My compliance this period",
    attentionNeeded: "Attention needed",
    nearYearlyLimit: "Near yearly limit",
    withinLimits: "Within limits",
    averageWeeklyHours: "Average weekly hours",
    overtimeThisYear: "Overtime this year",
    capSuffix: "/ {{hours}}h cap",
    limitSuffix: "/ {{hours}}h limit",
  },

  // ── Absences ──────────────────────────────────────────────────────────────
  absences: {
    title: "Absences",
    subtitle: "Leave, sickness and other non-working days",
    requestTitle: "Request an absence",
    start: "Start",
    end: "End",
    reasonOptional: "Reason (optional)",
    submit: "Submit request",
    submitting: "Submitting…",
    chooseDates: "Please choose a start and end date.",
    mine: "My absences",
    all: "All absences",
    empty: "No absences.",
  },

  // ── Time Records (whole workforce) ────────────────────────────────────────
  records: {
    title: "Time Records",
    subtitleFull: "All working-time entries · overtime approval · corrections",
    subtitleReadOnly: "All working-time entries · read-only view",
    inOut: "In / Out",
    approveOvertime: "Approve OT",
    correct: "Correct",
    correctedFlag: "corrected",
    restViolation: "rest <11h",
    empty: "No records.",
    filterAll: "All",

    correctTitle: "Correct time entry",
    correctClockIn: "Clock in",
    correctClockOut: "Clock out",
    correctReason: "Reason (required)",
    correctReasonPlaceholder: "e.g. employee forgot to clock out",
    correctSave: "Save correction",
    correctReasonMissing: "A correction reason is required.",
  },

  // ── Dashboard ─────────────────────────────────────────────────────────────
  dashboard: {
    title: "Dashboard",
    subtitle: "Live working-time overview for your organisation",
    loading: "Loading dashboard…",
    clockedInNow: "Clocked in now",
    onBreakNow: "On break",
    completedToday: "Completed today",
    missingClockOut: "Missing clock-out",
    needsAttention: "Needs attention",
    overtimeAwaiting: "Overtime awaiting approval",
    absencesPending: "Absence requests pending",
    last7Days: "Last 7 days",
    workedHours: "Worked hours",
    overtimeHours: "Overtime hours",
    missingBreaks: "Missing breaks",
    shortBreaks: "Short breaks",
    restViolations: "Rest violations (11h)",
    todaysEntries: "Today's entries",
    noActivityToday: "No activity today.",
    recentActivity: "Recent activity",
    noRecentActivity: "No recent activity.",
    blockedSuffix: " (blocked)",
  },

  // ── Settlement period ─────────────────────────────────────────────────────
  settlement: {
    title: "Settlement Reconciliation",
    subtitle:
      "Okres rozliczeniowy — 48h weekly average (art. 131) & 150h/year overtime (art. 151 §3)",
    onlyBreaches: "Only breaches",
    currentPeriod: "Current period",
    calculating: "Reconciling hours…",
    noBreaches: "No cap breaches this period. 🎉",
    noEntries: "No time entries in this period yet.",
    workedPeriod: "Worked (period)",
    avgWeeklyCap: "Avg weekly (≤48h)",
    overtimeYearCap: "Overtime (year, ≤150h)",
    overCap: "{{hours}}h — over 48h",
    overLimit: "{{duration}} — over limit",
    nearLimit: "{{duration}} — near limit",
    protections: "Protections",
    open: "Open",

    myTitle: "My Settlement Period",
    mySubtitle:
      "Okres rozliczeniowy — your average week (art. 131) and your overtime this year (art. 151 §3)",
    myLoading: "Working out your hours…",
    whereYouStand: "Where you stand",
    workedThisPeriod: "Worked this period",
    averageWeek: "Average week",
    overtimeThisYear: "Overtime this year",
    capSuffix: "/ {{hours}}h cap",
    limitSuffix: "/ {{hours}}h limit",
    overALegalLimit: "Over a legal limit",
    nearYearlyLimit: "Near yearly limit",
    withinLimits: "Within limits",
    myNote:
      "Your average working week may not go over 48 hours including overtime (art. 131), and your overtime may not go over the yearly limit (art. 151 §3). If either figure is red, speak to HR.",

    protectionsTitle: "Working-time protections",
    protectionsLoading: "Loading profile…",
    protectionsViewOnly: "View only — you can see these protections but not change them.",
    pregnant: "Pregnant employee",
    pregnantHint: "No overtime or night work (art. 178 §1)",
    youngWorker: "Young worker (młodociany)",
    youngWorkerHint: "No overtime or night work (art. 203)",
    parentUnder4: "Parent of a child under 4",
    parentUnder4Hint: "Overtime / night work only with consent (art. 178 §2)",
    consentTitle: "Consent (for parent of a small child)",
    consentOvertime: "Agrees to overtime",
    consentNightWork: "Agrees to night work",
  },

  // ── Working Time Policy ───────────────────────────────────────────────────
  policy: {
    title: "Working Time Policy",
    subtitleEdit: "Regulamin czasu pracy — the rules the engine applies",
    subtitleRead: "Regulamin czasu pracy — the rules that apply to you",
    viewOnlyTitle: "View only.",
    viewOnlyBody:
      "These are the working-time rules your employer has set. Changing them is an employer-level decision (Kodeks pracy art. 150), so only an administrator can edit this page.",
    saved: "Policy saved.",
    noPolicy: "No policy",

    system: "Working-time system",
    dailyNorm: "Daily norm (hours)",
    weeklyNorm: "Weekly norm (hours)",
    workDaysPerWeek: "Work days / week",
    settlementPeriodMonths: "Settlement period (months)",
    dailyRest: "Daily rest (hours)",
    weeklyRest: "Weekly rest (hours)",
    overtimeNeedsApproval:
      "Overtime must be approved by a manager before it counts",

    limitsTitle: "Settlement-period limits",
    maxAvgWeekly: "Max average weekly hours (art. 131)",
    annualOvertimeLimit: "Yearly overtime limit — hours (art. 151 §3)",

    nightTitle: "Night work",
    nightStart: "Night starts (hour)",
    nightEnd: "Night ends (hour)",
    nightPremium: "Night bonus (%)",

    locationTitle: "Location monitoring",
    locationIntro:
      "Off by default. Turning this on tracks where mobile clock-ins happen — this is employee monitoring under art. 22², so employees must accept the notice first.",
    recordLocation: "Record clock-in / clock-out location",
    blockOutside: "Block clock-in outside a work site",
    ignoreGpsWorse: "Ignore GPS worse than (metres)",
    allowedSites: "Allowed work sites",
    addSite: "+ Add site",
    noSites:
      'No sites set. Without a site, "on-site" cannot be checked — clock-ins are only recorded.',
    site: "Site",
    latitude: "Latitude",
    longitude: "Longitude",
    radius: "Radius (m)",
    remove: "Remove",
    monitoringNoticeText: "Monitoring notice shown to employees",

    breakRuleTitle: "Break rule (fixed by law, art. 134):",
    breakRuleBody:
      "at least 15 min once daily working time reaches 6h, +15 min over 9h, +15 min over 16h. Overtime is time worked beyond the daily norm above, not simply a long shift.",
    savePolicy: "Save policy",

    // The seven working-time systems allowed by the Polish Labour Code.
    systems: {
      STANDARD: "Standard (podstawowy) — 8h/day, 40h/week",
      EQUIVALENT: "Equivalent (równoważny)",
      TASK_BASED: "Task-based (zadaniowy)",
      SHORTENED_WEEK: "Shortened week (skrócony tydzień)",
      WEEKEND_WORK: "Weekend work (weekendowy)",
      FLEXIBLE: "Flexible (ruchomy)",
      INDIVIDUAL: "Individual schedule (indywidualny)",
    },
  },

  // ── Audit trail ───────────────────────────────────────────────────────────
  audit: {
    title: "Audit Trail",
    subtitle: "Immutable record of every working-time action (10-year retention)",
    loading: "Loading audit trail…",
    when: "When",
    user: "User",
    action: "Action",
    resource: "Resource",
    result: "Result",
    empty: "No audit entries.",
    pageOf: "Page {{page}} of {{total}}",
    filterAll: "All",
  },

  // ── Live alert inbox (the bell) ───────────────────────────────────────────
  notifications: {
    title: "Notifications",
    live: "Live",
    reconnecting: "Reconnecting…",
    markAllRead: "Mark all read",
    empty: "You have no notifications.",
    aria: "Notifications",
    ariaWithUnread: "Notifications, {{count}} unread",
  },

  // ── Blocked-access screens ────────────────────────────────────────────────
  access: {
    signedInAs: "Signed in as",

    suspendedEyebrow: "Account Suspended",
    suspendedTitle: "Your account has been suspended",
    suspendedMessage:
      "Your account is currently switched off, so WorkPulse is not available to you. Please contact your administrator to have your account reactivated.",

    moduleEyebrow: "Access Restricted",
    moduleTitle: "WorkPulse is not part of your plan",
    moduleMessage:
      "Your account does not include the WorkPulse module. Please contact your administrator to have WorkPulse added to your organisation's subscription.",

    planEyebrow: "Subscription Expired",
    planTitle: "Your plan has expired",
    planMessage:
      "Your organisation's subscription has ended, so WorkPulse is temporarily locked. Please contact your administrator to renew the plan and restore access.",

    permissionEyebrow: "Permission Required",
    permissionTitle: "You do not have access to WorkPulse",
    permissionMessage:
      "Your organisation uses WorkPulse, but your account has not been given permission to open it. Please ask your administrator to grant you WorkPulse access.",

    pageEyebrow: "Not Available For Your Role",
    pageTitle: "This page is not part of your role",
    pageMessage:
      "You have access to WorkPulse, but this particular page is reserved for other roles. If you believe you need it, please ask your administrator.",
  },

  // ── Login / SSO ───────────────────────────────────────────────────────────
  login: {
    redirecting: "Redirecting to RegulaOne login…",
    returnNote: "You will be returned to WorkPulse automatically after signing in.",
    verifying: "Verifying session…",
  },

  // ── 404 ───────────────────────────────────────────────────────────────────
  notFound: {
    title: "Page not found",
    message: "The page you were looking for does not exist.",
    back: "Back to Clock",
  },
};

export default en;
