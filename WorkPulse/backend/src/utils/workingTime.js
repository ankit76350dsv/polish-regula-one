// ─────────────────────────────────────────────────────────────────────────────
// WorkPulse — Polish Labour Code working-time calculation engine
// ─────────────────────────────────────────────────────────────────────────────
//
// This one file holds all the rules that turn raw clock times into legally
// meaningful numbers: how long a person worked, how much break they were owed,
// whether they took it, how much overtime they did, and whether their rest
// periods were respected.
//
// IMPORTANT LEGAL NOTE (why this file exists):
//   An earlier idea was "if a shift is longer than 6 hours, it is overtime".
//   That is WRONG under Polish law. Working more than 6 hours mainly gives the
//   employee the right to a BREAK — it does not by itself create overtime.
//   Overtime is work that goes BEYOND the employee's normal daily/weekly norm
//   (usually 8 hours a day / an average of 40 hours a week).
//
// Legal sources (Polish Labour Code — Kodeks pracy):
//   * Art. 129  — standard norm: 8 h/day, average 40 h/week in a 5-day week.
//   * Art. 134  — rest break: at least 15 min if the daily working time is at
//                 least 6 h; +15 min if more than 9 h; +15 min if more than 16 h.
//   * Art. 132  — daily rest: at least 11 uninterrupted hours per day.
//   * Art. 133  — weekly rest: at least 35 uninterrupted hours per week.
//   * Art. 151  — overtime: work above the applicable working-time norm.
// (Verify current wording on gov.pl / isap.sejm.gov.pl before production use.)
//
// Everything here works in MINUTES to avoid floating-point hours drift. Helpers
// at the bottom convert to hours for display.

const MINUTES_PER_HOUR = 60;

// ── Break entitlement ────────────────────────────────────────────────────────
// Given how many minutes a person actually worked in the day, return how many
// minutes of break the law says they must be given.
//
//   worked at least  6 h  → 15 minutes
//   worked more than 9 h  → 30 minutes (an extra 15)
//   worked more than 16 h → 45 minutes (a further 15)
//
// Below 6 hours there is no statutory break entitlement, so we return 0.
function requiredBreakMinutes(workedMinutes) {
  const hours = workedMinutes / MINUTES_PER_HOUR;

  if (hours > 16) return 45;
  if (hours > 9) return 30;
  if (hours >= 6) return 15;
  return 0;
}

// ── Break compliance status ──────────────────────────────────────────────────
// Compares the break the person actually took against the break they were owed
// and returns a simple label the UI and reports can rely on.
//
//   NOT_REQUIRED  — the shift was too short to earn a break.
//   COMPLIANT     — they took at least the required break.
//   SHORT_BREAK   — they took some break, but less than required.
//   MISSING_BREAK — they were owed a break but took none.
function breakComplianceStatus(requiredMinutes, takenMinutes) {
  if (requiredMinutes <= 0) return 'NOT_REQUIRED';
  if (takenMinutes >= requiredMinutes) return 'COMPLIANT';
  if (takenMinutes > 0) return 'SHORT_BREAK';
  return 'MISSING_BREAK';
}

// ── Total break minutes ──────────────────────────────────────────────────────
// Adds up every completed break in a time entry. Breaks that were started but
// never ended (breakEnd is null) are ignored here — they are counted live
// elsewhere and flagged by the "open break" cron job.
function totalBreakMinutes(breaks = []) {
  return breaks.reduce((sum, b) => {
    if (!b.breakStart || !b.breakEnd) return sum;
    const minutes = diffMinutes(b.breakStart, b.breakEnd);
    return sum + (minutes > 0 ? minutes : 0);
  }, 0);
}

// ── Overtime ─────────────────────────────────────────────────────────────────
// Overtime is the net worked time that goes ABOVE the scheduled daily norm.
// It is never negative (working less than the norm is undertime, not overtime).
//
//   netWorkedMinutes    — time actually worked (gross presence minus breaks).
//   scheduledMinutes    — the employee's daily norm for that day (from policy).
function dailyOvertimeMinutes(netWorkedMinutes, scheduledMinutes) {
  return Math.max(0, netWorkedMinutes - scheduledMinutes);
}

// ── Daily rest check (Art. 132 — at least 11 hours) ──────────────────────────
// Compares when the previous shift ended with when the new shift starts.
// If the gap is shorter than 11 hours, the daily-rest rule was broken.
// Returns null when there is no previous shift to compare against.
const DAILY_REST_MINUTES = 11 * MINUTES_PER_HOUR; // 660

function checkDailyRest(previousClockOut, currentClockIn) {
  if (!previousClockOut || !currentClockIn) return null;

  const restGap = diffMinutes(previousClockOut, currentClockIn);
  return {
    restGapMinutes: restGap,
    requiredMinutes: DAILY_REST_MINUTES,
    violation: restGap < DAILY_REST_MINUTES,
  };
}

// ── Weekly rest check (Art. 133 — at least 35 hours) ─────────────────────────
// Given every clock-in/clock-out pair inside one week (sorted by time), find the
// single longest continuous gap between the end of one shift and the start of
// the next. If the biggest gap is under 35 hours, the weekly-rest rule was broken.
const WEEKLY_REST_MINUTES = 35 * MINUTES_PER_HOUR; // 2100

function checkWeeklyRest(shifts = []) {
  // Keep only finished shifts and sort them from earliest to latest.
  const finished = shifts
    .filter((s) => s.clockIn && s.clockOut)
    .map((s) => ({ clockIn: new Date(s.clockIn), clockOut: new Date(s.clockOut) }))
    .sort((a, b) => a.clockIn - b.clockIn);

  if (finished.length === 0) {
    // No work this week means the whole week was rest — always compliant.
    return { longestRestMinutes: WEEKLY_REST_MINUTES, requiredMinutes: WEEKLY_REST_MINUTES, violation: false };
  }

  let longestRest = 0;
  for (let i = 1; i < finished.length; i += 1) {
    const gap = diffMinutes(finished[i - 1].clockOut, finished[i].clockIn);
    if (gap > longestRest) longestRest = gap;
  }

  return {
    longestRestMinutes: longestRest,
    requiredMinutes: WEEKLY_REST_MINUTES,
    // With only one shift in the week the surrounding days are the rest period,
    // so a single shift never counts as a weekly-rest violation.
    violation: finished.length > 1 && longestRest < WEEKLY_REST_MINUTES,
  };
}

// ── Weekly rest over a rolling 7-day window (Art. 133) ───────────────────────
// The simple checkWeeklyRest above only looks at the gaps BETWEEN shifts. But
// the law wants at least 35 continuous hours of rest inside every 7-day period,
// and the biggest rest block might be at the START of the week (before the first
// shift) or the END (after the last shift) — not just between two shifts.
//
// This version looks at a fixed time window (for example "the last 7 days") and
// finds the single longest stretch of time with NO work at all, including the
// time before the first shift and after the last shift in that window. That is
// the honest answer to "did this person get their 35 hours off this week?".
//
//   shifts      — every shift for the employee (only finished ones are used).
//   windowStart — the start of the 7-day window (a Date or ISO string).
//   windowEnd   — the end of the window (usually "now").
function checkWeeklyRestWindow(shifts = [], windowStart, windowEnd) {
  const start = new Date(windowStart).getTime();
  const end = new Date(windowEnd).getTime();

  // Turn finished shifts into {start,end} time ranges, keep only the ones that
  // fall inside the window, and cut them to the window edges so a shift that
  // began before the window does not count as work from before it.
  const intervals = shifts
    .filter((s) => s.clockIn && s.clockOut)
    .map((s) => ({ start: new Date(s.clockIn).getTime(), end: new Date(s.clockOut).getTime() }))
    .filter((iv) => iv.end > start && iv.start < end)
    .map((iv) => ({ start: Math.max(iv.start, start), end: Math.min(iv.end, end) }))
    .sort((a, b) => a.start - b.start);

  // Merge shifts that touch or overlap so the gaps between them are real rest.
  const merged = [];
  for (const iv of intervals) {
    const last = merged[merged.length - 1];
    if (last && iv.start <= last.end) {
      last.end = Math.max(last.end, iv.end);
    } else {
      merged.push({ ...iv });
    }
  }

  // Walk the window and measure every rest gap: before the first shift, between
  // shifts, and after the last shift. Keep the longest one.
  let longest = 0;
  let cursor = start;
  for (const iv of merged) {
    if (iv.start - cursor > longest) longest = iv.start - cursor;
    if (iv.end > cursor) cursor = iv.end;
  }
  if (end - cursor > longest) longest = end - cursor;

  const longestRestMinutes = Math.round(longest / 60000);
  return {
    longestRestMinutes,
    requiredMinutes: WEEKLY_REST_MINUTES,
    violation: longestRestMinutes < WEEKLY_REST_MINUTES,
  };
}

// ── Night work (Art. 151⁷) ───────────────────────────────────────────────────
// Polish law says "night" is 8 chosen hours between 21:00 and 07:00. Work done
// in that window earns an extra 20% night bonus (art. 151⁸). This helper adds up
// how many minutes of a shift fell inside the night window. Because the window
// crosses midnight, we check the night block for each day the shift could touch.
function overlapMinutes(aStart, aEnd, bStart, bEnd) {
  const s = Math.max(aStart, bStart);
  const e = Math.min(aEnd, bEnd);
  return e > s ? Math.round((e - s) / 60000) : 0;
}

function nightWorkMinutes(clockIn, clockOut, startHour = 21, endHour = 7) {
  if (!clockIn || !clockOut) return 0;
  const start = new Date(clockIn).getTime();
  const end = new Date(clockOut).getTime();
  if (end <= start) return 0;

  let total = 0;
  const firstDay = new Date(clockIn);
  firstDay.setHours(0, 0, 0, 0);
  const lastDay = new Date(clockOut);
  lastDay.setHours(0, 0, 0, 0);

  // Look at each night block from the day before the shift to the shift's last
  // day. Each block runs from `startHour` one day to `endHour` the next day.
  const ONE_DAY = 24 * 60 * 60 * 1000;
  for (let t = firstDay.getTime() - ONE_DAY; t <= lastDay.getTime(); t += ONE_DAY) {
    const winStart = new Date(t);
    winStart.setHours(startHour, 0, 0, 0);
    const winEnd = new Date(t + ONE_DAY);
    winEnd.setHours(endHour, 0, 0, 0);
    total += overlapMinutes(start, end, winStart.getTime(), winEnd.getTime());
  }
  return total;
}

// ── Overtime pay rate (Art. 151¹) ────────────────────────────────────────────
// Overtime is paid with an extra bonus on top of normal pay:
//   * 100% — overtime at night, on Sundays, or on public holidays.
//   *  50% — all other overtime (for example an ordinary weekday).
// We favour the employee: if the shift touched any night hours we use 100%.
// (This is a simplification; exact pay also depends on the schedule and any
//  day off given in exchange — payroll should confirm the final figure.)
function overtimePremiumRate({ isSunday = false, isHoliday = false, nightMinutes = 0 } = {}) {
  if (isSunday || isHoliday || nightMinutes > 0) return 100;
  return 50;
}

// ── The main calculator ──────────────────────────────────────────────────────
// Takes a finished (or in-progress) time entry plus the day's scheduled norm and
// returns every derived working-time number in one object. This is the single
// place the rest of the app calls so the numbers are always computed the same way.
//
// entry: { clockIn, clockOut, breaks: [{ breakStart, breakEnd }] }
// scheduledMinutes: the daily norm for this employee/day (default 8 h = 480).
function computeEntryTotals(entry, scheduledMinutes = 480) {
  const { clockIn, clockOut, breaks = [] } = entry;

  // Gross presence = time between clock-in and clock-out. If the person has not
  // clocked out yet we measure up to "now" so live dashboards show progress.
  const end = clockOut || new Date();
  const grossMinutes = clockIn ? Math.max(0, diffMinutes(clockIn, end)) : 0;

  const breakMinutes = totalBreakMinutes(breaks);

  // Net worked time excludes breaks. This matches the worked examples:
  //   09:00–18:30 with a 30-min break  → 9 h net worked → 1 h overtime.
  const netWorkedMinutes = Math.max(0, grossMinutes - breakMinutes);

  const requiredBreak = requiredBreakMinutes(netWorkedMinutes + breakMinutes);
  const overtime = dailyOvertimeMinutes(netWorkedMinutes, scheduledMinutes);

  return {
    grossMinutes,
    breakMinutes,
    netWorkedMinutes,
    scheduledMinutes,

    // Break compliance
    requiredBreakMinutes: requiredBreak,
    breakRequired: requiredBreak > 0,
    breakTaken: breakMinutes > 0,
    breakComplianceStatus: breakComplianceStatus(requiredBreak, breakMinutes),

    // Overtime
    overtimeMinutes: overtime,
    isOvertime: overtime > 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Settlement-period rules (okres rozliczeniowy)
// ─────────────────────────────────────────────────────────────────────────────
//
// Polish law does NOT only look at one day. It also checks longer periods:
//
//   * Art. 131 §1 — across the whole settlement period, the AVERAGE working time
//                   per week (including overtime) must not go above 48 hours.
//   * Art. 151 §3 — overtime worked because of the employer's special needs is
//                   limited to 150 hours per calendar year (a company can raise
//                   this in its work rules, so we keep it configurable).
//
// A "settlement period" (okres rozliczeniowy) is a block of 1–4 months (or more
// in special systems) over which the employer balances the hours. To keep the
// periods steady and non-overlapping, we anchor them to the start of the
// calendar year and step forward in equal blocks of `months`.

const WEEKLY_AVG_CAP_MINUTES = 48 * 60; // art. 131 — 48h average weekly cap
const ANNUAL_OVERTIME_LIMIT_MINUTES = 150 * 60; // art. 151 §3 — 150h/year default
const MINUTES_PER_WEEK = 7 * 24 * 60;

// Work out which settlement period a given date falls into, anchored to 1 Jan.
// Returns the period's start (inclusive) and end (exclusive) as Dates.
//   referenceDate — any date inside the period we want.
//   months        — how many whole months each period lasts (from the policy).
function settlementPeriodBounds(referenceDate, months = 1) {
  const ref = new Date(referenceDate);
  const size = Math.max(1, Math.round(months));
  const year = ref.getFullYear();

  // How many months into the year we are (0 = January).
  const monthIndex = ref.getMonth();
  // Which block of `size` months this month sits in.
  const blockStartMonth = Math.floor(monthIndex / size) * size;

  const start = new Date(year, blockStartMonth, 1, 0, 0, 0, 0);
  const end = new Date(year, blockStartMonth + size, 1, 0, 0, 0, 0);
  return { start, end };
}

// The average working time per 7-day week across a period.
// totalWorkedMinutes already includes overtime (it is the real time worked).
function averageWeeklyMinutes(totalWorkedMinutes, periodStart, periodEnd) {
  const spanMinutes = diffMinutes(periodStart, periodEnd);
  const weeks = spanMinutes / MINUTES_PER_WEEK;
  if (weeks <= 0) return 0;
  return Math.round(totalWorkedMinutes / weeks);
}

// ── Small time helpers ───────────────────────────────────────────────────────

// Whole minutes between two dates (b - a). Accepts Date objects or ISO strings.
function diffMinutes(a, b) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

// Convert minutes to a rounded number of hours (2 decimals) for display.
function minutesToHours(minutes) {
  return Math.round((minutes / MINUTES_PER_HOUR) * 100) / 100;
}

// Convert minutes to a friendly "Xh Ym" string for the UI.
function formatDuration(minutes) {
  const safe = Math.max(0, Math.round(minutes || 0));
  const h = Math.floor(safe / MINUTES_PER_HOUR);
  const m = safe % MINUTES_PER_HOUR;
  return `${h}h ${m}m`;
}

module.exports = {
  MINUTES_PER_HOUR,
  DAILY_REST_MINUTES,
  WEEKLY_REST_MINUTES,
  WEEKLY_AVG_CAP_MINUTES,
  ANNUAL_OVERTIME_LIMIT_MINUTES,
  MINUTES_PER_WEEK,
  settlementPeriodBounds,
  averageWeeklyMinutes,
  requiredBreakMinutes,
  breakComplianceStatus,
  totalBreakMinutes,
  dailyOvertimeMinutes,
  checkDailyRest,
  checkWeeklyRest,
  checkWeeklyRestWindow,
  nightWorkMinutes,
  overtimePremiumRate,
  computeEntryTotals,
  diffMinutes,
  minutesToHours,
  formatDuration,
};
