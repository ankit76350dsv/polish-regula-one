// ─────────────────────────────────────────────────────────────────────────────
// Polish public holidays (dni ustawowo wolne od pracy)
// ─────────────────────────────────────────────────────────────────────────────
//
// WHY THIS EXISTS:
//   Working on a Sunday or a public holiday has special rules in Poland: it is
//   usually restricted, and overtime on those days is paid at the higher 100%
//   rate (art. 151¹). To apply those rules we must know EXACTLY which days are
//   public holidays — and some of them move every year because they depend on
//   Easter.
//
// Legal source: Ustawa z dnia 18 stycznia 1951 r. o dniach wolnych od pracy.
// The list below matches that act. Fixed-date holidays never move; the four
// Easter-based ones (Easter Monday, Pentecost, Corpus Christi) are worked out
// from the date of Easter Sunday.
// (Verify against gov.pl before production use.)

// Format a Date as "YYYY-MM-DD" in LOCAL time (not UTC) so the calendar day is
// the same one the employee experienced. Padded so it always has two digits.
function toKey(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Work out the date of Easter Sunday for a given year.
// Uses the well-known "Anonymous Gregorian algorithm" (Meeus/Jones/Butcher).
// Returns a Date at local midnight.
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

// Add a number of days to a date and return the new date (local midnight).
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Cache the computed holiday set per year so we do not recompute on every call.
const cacheByYear = new Map();

// Return a Set of "YYYY-MM-DD" strings for every Polish public holiday in a year.
function getHolidaySet(year) {
  if (cacheByYear.has(year)) return cacheByYear.get(year);

  const easter = easterSunday(year);

  const dates = [
    new Date(year, 0, 1), // 1 Jan  — Nowy Rok (New Year)
    new Date(year, 0, 6), // 6 Jan  — Trzech Króli (Epiphany)
    easter, // Wielkanoc (Easter Sunday)
    addDays(easter, 1), // Poniedziałek Wielkanocny (Easter Monday)
    new Date(year, 4, 1), // 1 May  — Święto Pracy (Labour Day)
    new Date(year, 4, 3), // 3 May  — Święto Konstytucji 3 Maja
    addDays(easter, 49), // Zielone Świątki (Pentecost / Whit Sunday)
    addDays(easter, 60), // Boże Ciało (Corpus Christi)
    new Date(year, 7, 15), // 15 Aug — Wniebowzięcie NMP / Armed Forces Day
    new Date(year, 10, 1), // 1 Nov  — Wszystkich Świętych (All Saints)
    new Date(year, 10, 11), // 11 Nov — Święto Niepodległości (Independence Day)
    new Date(year, 11, 25), // 25 Dec — Boże Narodzenie (Christmas Day)
    new Date(year, 11, 26), // 26 Dec — drugi dzień świąt (Second Day of Christmas)
  ];

  // 24 Dec — Wigilia (Christmas Eve). Added to the statutory list by the
  // amendment of Feb 2025, so it only counts as a public holiday from 2025 on.
  // Verified against gov.pl (Zielona Linia) and PIP, July 2026.
  if (year >= 2025) {
    dates.push(new Date(year, 11, 24));
  }

  const set = new Set(dates.map(toKey));
  cacheByYear.set(year, set);
  return set;
}

// Is the given date a Polish public holiday?
function isPublicHoliday(date) {
  const d = new Date(date);
  return getHolidaySet(d.getFullYear()).has(toKey(d));
}

// Is the given date a Sunday? (getDay(): 0 = Sunday.)
function isSunday(date) {
  return new Date(date).getDay() === 0;
}

module.exports = {
  toKey,
  easterSunday,
  getHolidaySet,
  isPublicHoliday,
  isSunday,
};
