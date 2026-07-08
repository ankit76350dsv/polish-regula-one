const { body } = require('express-validator');

// Validation rules for generating an annual report.
const generateReportRules = [
  body('companyId')
    .notEmpty()
    .withMessage('companyId is required')
    .isMongoId()
    .withMessage('companyId is not a valid id'),

  body('year')
    .isInt({ min: 2000, max: new Date().getFullYear() + 1 })
    .withMessage('year must be a valid 4-digit year'),
];

module.exports = { generateReportRules };
