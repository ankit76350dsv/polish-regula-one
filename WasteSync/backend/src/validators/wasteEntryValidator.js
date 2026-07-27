const { body } = require('express-validator');
const { WASTE_CATEGORY_KEYS } = require('../utils/wasteCategories');

// Validation rules for recording a month of waste data.
const wasteEntryRules = [
  body('companyId')
    .notEmpty()
    .withMessage('companyId is required')
    .isMongoId()
    .withMessage('companyId is not a valid id'),

  body('year')
    .isInt({ min: 2000, max: new Date().getFullYear() + 1 })
    .withMessage('year must be a valid 4-digit year'),

  body('month')
    .isInt({ min: 1, max: 12 })
    .withMessage('month must be between 1 and 12'),

  // items must be a non-empty array of { category, weightKg } objects.
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one waste item is required'),

  body('items.*.category')
    .isIn(WASTE_CATEGORY_KEYS)
    .withMessage('Each item must have a valid waste category'),

  // Weight must be a number that is zero or greater — negatives are rejected.
  body('items.*.weightKg')
    .isFloat({ min: 0 })
    .withMessage('Each weight must be a number of 0 kg or more'),

  body('notes')
    .optional({ checkFalsy: true })
    .isLength({ max: 1000 })
    .withMessage('Notes are too long'),
];

module.exports = { wasteEntryRules };
