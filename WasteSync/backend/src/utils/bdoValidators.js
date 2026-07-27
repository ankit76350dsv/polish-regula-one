// Small, reusable validation helpers for BDO (Polish waste database) data.
// These are pure functions (no database, no request) so they are easy to test
// and can be used from validators, services, and report generation alike.

const { WASTE_CATEGORY_KEYS } = require('./wasteCategories');

// A BDO registration number is exactly 9 digits (per the Polish BDO register).
// We strip spaces first because users often type the number with separators.
const BDO_NUMBER_REGEX = /^\d{9}$/;

// Returns true only when the value is a clean 9-digit BDO number.
const isValidBdoNumber = (value) => {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  const cleaned = String(value).replace(/\s/g, '');
  return BDO_NUMBER_REGEX.test(cleaned);
};

// Removes spaces so "123 456 789" is stored as "123456789".
const normaliseBdoNumber = (value) => String(value ?? '').replace(/\s/g, '');

// A reporting year must be a sensible 4-digit year. We allow from 2000 up to
// next year (some reports are prepared in advance for the coming period).
const isValidReportingYear = (year) => {
  const y = Number(year);
  const maxYear = new Date().getFullYear() + 1;
  return Number.isInteger(y) && y >= 2000 && y <= maxYear;
};

// A month must be 1..12.
const isValidMonth = (month) => {
  const m = Number(month);
  return Number.isInteger(m) && m >= 1 && m <= 12;
};

// A waste weight must be a number that is zero or greater. Negative weights are
// physically impossible and are explicitly forbidden by BDO validation rules.
const isValidWeight = (weight) => {
  const w = Number(weight);
  return Number.isFinite(w) && w >= 0;
};

// Confirms a category code is one we actually support.
const isValidCategory = (category) => WASTE_CATEGORY_KEYS.includes(category);

// Compares a year's per-category totals against the configured legal thresholds
// and returns a structured result the report can store and display.
//
// thresholds: array of { category, reportingThresholdKg, maxWeightKg }
// categoryTotals: object like { PAPER: 1200, PLASTIC: 300, ... }
//
// We flag two kinds of issue:
//   - "OVER_MAX"  : the total is above the legal maximum (a hard breach)
//   - "OVER_REPORTING" : the total crossed the reporting threshold (info only)
//
// IMPORTANT — the "not configured" case:
// This function can only check the totals against limits that ACTUALLY EXIST in
// the database. If no thresholds are configured (the list is empty), there is
// nothing to compare against. In that case we must NOT report a green "passed",
// because that would give a false sense of safety — the report would look
// approved even though no legal limit was ever checked. Instead we return
// `evaluated: false` so the UI and the PDF can clearly say "not evaluated —
// no thresholds configured". This is what makes the check honest and
// audit-defensible.
const evaluateThresholds = (categoryTotals = {}, thresholds = []) => {
  const breaches = [];

  // Only count limits that carry a usable number. A threshold row with both
  // maxWeightKg and reportingThresholdKg unset checks nothing.
  const usableThresholds = thresholds.filter(
    (t) => t && (t.maxWeightKg != null || t.reportingThresholdKg != null)
  );

  for (const t of usableThresholds) {
    const total = Number(categoryTotals[t.category] || 0);

    if (t.maxWeightKg != null && total > Number(t.maxWeightKg)) {
      breaches.push({
        category: t.category,
        type: 'OVER_MAX',
        total,
        limit: Number(t.maxWeightKg),
        message: `Total for ${t.category} (${total} kg) exceeds the legal maximum of ${t.maxWeightKg} kg`,
      });
    } else if (
      t.reportingThresholdKg != null &&
      total > Number(t.reportingThresholdKg)
    ) {
      breaches.push({
        category: t.category,
        type: 'OVER_REPORTING',
        total,
        limit: Number(t.reportingThresholdKg),
        message: `Total for ${t.category} (${total} kg) crossed the reporting threshold of ${t.reportingThresholdKg} kg`,
      });
    }
  }

  // Were there any real limits to check? If not, the result is "not evaluated".
  const evaluated = usableThresholds.length > 0;

  return {
    // Tells the UI/PDF whether a real check happened at all.
    evaluated,
    // How many category limits we compared against (0 = nothing configured).
    thresholdsChecked: usableThresholds.length,
    // `passed` is only meaningful when `evaluated` is true. We make it false
    // when nothing was evaluated so no caller can mistake "unchecked" for "ok".
    passed: evaluated && breaches.every((b) => b.type !== 'OVER_MAX'),
    breaches,
  };
};

module.exports = {
  isValidBdoNumber,
  normaliseBdoNumber,
  isValidReportingYear,
  isValidMonth,
  isValidWeight,
  isValidCategory,
  evaluateThresholds,
};
