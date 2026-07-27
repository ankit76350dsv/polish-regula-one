const { body } = require('express-validator');
const { WASTE_CATEGORY_KEYS } = require('../utils/wasteCategories');

// Validation rules for creating / updating a legal waste threshold.
// These run BEFORE the controller (via the validate middleware), so by the time
// the controller runs the input is guaranteed to be clean. We never trust the
// frontend to validate for us.
//
// A threshold sets, for one waste category in one year, either:
//   - reportingThresholdKg: a "you must report this" line (informational), and/or
//   - maxWeightKg:          the legal maximum (going over is a hard breach).
// At least one of the two numbers must be given, otherwise the row would check
// nothing.

const thresholdRules = [
  // The category must be one we actually support (PAPER, PLASTIC, ...).
  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required')
    .isIn(WASTE_CATEGORY_KEYS)
    .withMessage(`Category must be one of: ${WASTE_CATEGORY_KEYS.join(', ')}`),

  // The reporting year must be a sensible 4-digit year.
  body('year')
    .notEmpty()
    .withMessage('Year is required')
    .isInt({ min: 2000, max: 2100 })
    .withMessage('Year must be between 2000 and 2100')
    .toInt(),

  // The reporting threshold (kg). Optional, but if given must be zero or more.
  // Negative weights are physically impossible and are rejected.
  body('reportingThresholdKg')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('Reporting threshold must be a number that is 0 or greater')
    .toFloat(),

  // The legal maximum (kg). Optional, but if given must be zero or more.
  body('maxWeightKg')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('Legal maximum must be a number that is 0 or greater')
    .toFloat(),

  // A row that sets NEITHER number would check nothing, so we reject it.
  // We also reject a maximum that is lower than the reporting threshold, because
  // that ordering makes no sense (you would breach the max before you even had
  // to report).
  body().custom((value) => {
    const hasReporting = value.reportingThresholdKg != null && value.reportingThresholdKg !== '';
    const hasMax = value.maxWeightKg != null && value.maxWeightKg !== '';

    if (!hasReporting && !hasMax) {
      throw new Error('Set at least one of reportingThresholdKg or maxWeightKg');
    }
    if (
      hasReporting &&
      hasMax &&
      Number(value.maxWeightKg) < Number(value.reportingThresholdKg)
    ) {
      throw new Error('Legal maximum cannot be lower than the reporting threshold');
    }
    return true;
  }),
];

module.exports = { thresholdRules };
