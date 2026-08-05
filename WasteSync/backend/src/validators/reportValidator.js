const { body } = require('express-validator');

// Validation rules for generating an annual report.
//
// companyId was removed along with the Company collection. The report belongs to
// the tenant, which the auth middleware takes from the verified session, and the
// company's identity is read live from RegulaOne when the report is built.
const generateReportRules = [
  body('year')
    .isInt({ min: 2000, max: new Date().getFullYear() + 1 })
    .withMessage('year must be a valid 4-digit year'),
];

module.exports = { generateReportRules };
