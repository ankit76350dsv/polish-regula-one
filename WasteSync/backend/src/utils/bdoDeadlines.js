// ── Polish BDO filing deadlines ──────────────────────────────────────────────
//
// Two dates matter every year, and neither one changes the company's 9-digit BDO
// registration number — that number is assigned once and kept for life.
//
//   1. SPRAWOZDANIE (the annual waste report) — due 15 MARCH, and it covers the
//      PREVIOUS calendar year. So the report filed by 15 March 2026 is the report
//      for 2025.
//   2. OPŁATA ROCZNA (the yearly fee for staying in the register) — due by the
//      END OF FEBRUARY. WasteSync does not handle payments, so we only show the
//      date as a reminder and never claim it was paid.
//
// Legal basis: Ustawa z dnia 14 grudnia 2012 r. o odpadach — art. 54 (the
// registration number is assigned once at entry and is never reissued to anyone
// else), art. 59 (changes to company details go through an update application
// within 30 days, keeping the same number), art. 76 (annual report).
// Official sources: https://www.biznes.gov.pl/pl/portal/ou1625 and
// https://bdo.mos.gov.pl/
//
// WHY THE DATE MATHS LOOKS LIKE THIS
// These are Polish legal calendar dates. The server may well run in UTC, and a
// plain `new Date()` would then roll over to "tomorrow" at 01:00 Warsaw time in
// summer — which could mark a report overdue a day early, or hide that it is
// late. So we ask explicitly for today's date IN WARSAW and then do plain whole
// number maths on year/month/day. No clock, no time zone drift.

const WARSAW = 'Europe/Warsaw';

// Returns today's date in Poland as { year, month, day } — month is 1-12.
// Intl gives us the correct Warsaw calendar date whatever the server's own zone.
const todayInPoland = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: WARSAW,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { year: get('year'), month: get('month'), day: get('day') };
};

// Turns a calendar date into a day count, so two dates can simply be subtracted.
// Date.UTC is used purely as a calendar calculator here — never as a "moment in
// time" — which is exactly what makes the result time-zone proof.
const toDayNumber = ({ year, month, day }) =>
  Math.floor(Date.UTC(year, month - 1, day) / 86400000);

// The last day of February for a given year (29 in a leap year, 28 otherwise).
// Day 0 of March is the last day of February — the calendar does the leap-year
// rule for us, so we never have to write one.
const lastDayOfFebruary = (year) => new Date(Date.UTC(year, 2, 0)).getUTCDate();

// Formats a calendar date as "2026-03-15" for the API response.
const toIsoDate = ({ year, month, day }) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

// The next end-of-February fee deadline that has NOT already gone by.
const nextAnnualFeeDeadline = (today, todayNumber) => {
  const thisYear = { year: today.year, month: 2, day: lastDayOfFebruary(today.year) };
  if (toDayNumber(thisYear) >= todayNumber) return thisYear;
  const next = today.year + 1;
  return { year: next, month: 2, day: lastDayOfFebruary(next) };
};

/**
 * Works out which annual report is currently due, and whether it is late.
 *
 * The rule, in plain terms:
 *   - The report due on 15 March of THIS year covers LAST year.
 *   - If 15 March has passed and that report was never submitted, it is OVERDUE
 *     and stays the thing the user must deal with — we do not quietly move on to
 *     next year's deadline and let a missed legal filing disappear off the page.
 *   - If it was submitted, we look ahead to the next year's deadline instead.
 *
 * A customer who joined this year is NOT told that last year's report is
 * overdue. WasteSync has no data for a year before the account existed, so
 * calling it "overdue" would be an accusation we cannot support — and a warning
 * that is wrong on day one teaches people to ignore all the later ones. They may
 * still owe that filing under Polish law; it is simply not something this system
 * can know, so it says nothing rather than something false.
 *
 * @param {object} options
 * @param {(year:number) => Promise<{submitted:boolean, generated:boolean}>} options.lookupYear
 *        Asks the caller "what is the report situation for this year?".
 * @param {number|null} [options.activeSinceYear] The year the customer's account
 *        began. Years before it are treated as outside this system's knowledge.
 * @param {Date} [options.now] Injectable clock, so this can be unit tested.
 */
const resolveFilingObligation = async ({
  lookupYear,
  activeSinceYear = null,
  now = new Date(),
}) => {
  const today = todayInPoland(now);
  const todayNumber = toDayNumber(today);

  // The report due this coming 15 March is for last year.
  let coversYear = today.year - 1;
  let deadline = { year: today.year, month: 3, day: 15 };

  // That year is older than the account itself — skip to the first year this
  // system can actually speak for, and say so.
  const predatesAccount = activeSinceYear !== null && coversYear < activeSinceYear;
  if (predatesAccount) {
    coversYear = today.year;
    deadline = { year: today.year + 1, month: 3, day: 15 };
  }

  let status = await lookupYear(coversYear);

  // 15 March has gone. If last year's report is filed, the live obligation is
  // next year's; if it is not, it stays overdue and keeps the user's attention.
  if (!predatesAccount && todayNumber > toDayNumber(deadline) && status.submitted) {
    coversYear = today.year;
    deadline = { year: today.year + 1, month: 3, day: 15 };
    status = await lookupYear(coversYear);
  }

  const daysRemaining = toDayNumber(deadline) - todayNumber;

  return {
    // The year the currently-due annual report covers.
    coversYear,
    // 15 March of the year the report must be filed.
    deadline: toIsoDate(deadline),
    // Negative once the deadline has passed.
    daysRemaining,
    // A report exists for that year (files were produced).
    generated: status.generated,
    // The user confirmed they filed it in the BDO portal.
    submitted: status.submitted,
    // Past the deadline and still not filed — this is the state that costs money.
    overdue: daysRemaining < 0 && !status.submitted,

    // True when we skipped a year because it came before the account existed.
    // The UI uses it to explain why the first deadline shown is so far off.
    predatesAccount,

    // The register fee, shown as a reminder only. WasteSync has no way to know
    // whether it was actually paid, so it never reports a status for it.
    //
    // We always show the NEXT one. Once this year's end-of-February date has
    // passed we roll to next year's, because a reminder pointing at a date in the
    // past reads as "you missed this" — which we are in no position to claim.
    annualFee: {
      deadline: toIsoDate(nextAnnualFeeDeadline(today, todayNumber)),
      // Deliberately not tracked — see the note above.
      tracked: false,
    },
  };
};

module.exports = {
  resolveFilingObligation,
  // Exported for tests and reuse.
  todayInPoland,
  toDayNumber,
  lastDayOfFebruary,
};
