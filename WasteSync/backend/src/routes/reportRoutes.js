const express = require('express');
const reportController = require('../controllers/reportController');
const {
  isAuthenticatedUser,
  authorizePermissions,
  authorizeCapability,
} = require('../middleware/authMiddleware');
const { requireWasteSyncModule } = require('../middleware/moduleGuard');
const { validate } = require('../middleware/validate');
const { generateReportRules } = require('../validators/reportValidator');
const { CAPABILITIES } = require('../config/permissions');

const router = express.Router();

// Same front door as every other WasteSync route file: logged in -> tenant owns
// the module -> this user was given WasteSync. The per-action check is on each
// route below. See routes/companyRoutes.js for the full table of who may do what.
router.use(isAuthenticatedUser, requireWasteSyncModule, authorizePermissions());

// POST /api/reports/generate     — generate a new annual report (validated)
//
// Generating builds the XML + PDF from figures we already hold. It is a write (a
// new report record and new files appear), so auditors cannot do it — but HR can,
// because it changes nothing outside our own database.
router.post(
  '/generate',
  authorizeCapability(CAPABILITIES.REPORT_GENERATE),
  generateReportRules,
  validate,
  reportController.generateReport
);

// GET  /api/reports              — list generated reports
router.get('/', authorizeCapability(CAPABILITIES.REPORT_READ), reportController.listReports);

// GET  /api/reports/:id          — one report's summary
router.get('/:id', authorizeCapability(CAPABILITIES.REPORT_READ), reportController.getReport);

// GET  /api/reports/:id/download — presigned download URL (?format=xml|pdf)
//
// Downloading hands out a short-lived link to the actual file. That is the
// evidence pack an audit needs, so auditors DO have REPORT_EXPORT — it reads, it
// never changes anything, and every download is written to the audit log.
router.get(
  '/:id/download',
  authorizeCapability(CAPABILITIES.REPORT_EXPORT),
  reportController.downloadReport
);

// PATCH /api/reports/:id/submit  — mark as submitted to the BDO portal
//
// ADMIN ONLY. This flag is the company's own record that the annual waste report
// was filed in the government BDO register. If it were set wrongly, the company
// would believe it had filed when it had not, and would only find out when the
// authority asked. Filing is the employer's declaration, so confirming it stays
// with an admin — HR can prepare and download the report, an admin confirms it
// was actually filed.
router.patch(
  '/:id/submit',
  authorizeCapability(CAPABILITIES.REPORT_SUBMIT),
  reportController.submitReport
);

module.exports = router;
