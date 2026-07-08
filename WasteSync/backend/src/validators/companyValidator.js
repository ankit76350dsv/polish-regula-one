const { body } = require('express-validator');

// Validation rules for creating / updating a company.
// These run BEFORE the controller (via the validate middleware), so by the time
// the controller runs, the input is guaranteed to be clean. We never trust the
// frontend to validate for us.

const companyRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Company name is required')
    .isLength({ max: 200 })
    .withMessage('Company name is too long'),

  // The BDO number must be exactly 9 digits. We allow spaces in the input
  // (people type "123 456 789") and strip them before checking.
  body('bdoRegistrationNumber')
    .customSanitizer((value) => String(value ?? '').replace(/\s/g, ''))
    .matches(/^\d{9}$/)
    .withMessage('BDO registration number must be exactly 9 digits'),

  // NIP is the 10-digit Polish tax number. Optional, but if given must be valid.
  body('nip')
    .optional({ checkFalsy: true })
    .customSanitizer((value) => String(value ?? '').replace(/\s|-/g, ''))
    .matches(/^\d{10}$/)
    .withMessage('NIP must be 10 digits'),

  // REGON is 9 or 14 digits. Optional.
  body('regon')
    .optional({ checkFalsy: true })
    .customSanitizer((value) => String(value ?? '').replace(/\s|-/g, ''))
    .matches(/^(\d{9}|\d{14})$/)
    .withMessage('REGON must be 9 or 14 digits'),

  body('contactEmail')
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage('Contact email is not valid')
    .normalizeEmail(),

  body('address.postalCode')
    .optional({ checkFalsy: true })
    .matches(/^\d{2}-\d{3}$/)
    .withMessage('Postal code must be in the Polish format NN-NNN'),
];

module.exports = { companyRules };
