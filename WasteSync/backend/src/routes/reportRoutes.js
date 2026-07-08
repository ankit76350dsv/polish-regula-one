const express = require('express');
const reportController = require('../controllers/reportController');
const { isAuthenticatedUser } = require('../middleware/authMiddleware');
const { requireWasteSyncModule } = require('../middleware/moduleGuard');
const { validate } = require('../middleware/validate');
const { generateReportRules } = require('../validators/reportValidator');

const router = express.Router();

router.use(isAuthenticatedUser, requireWasteSyncModule);

// POST /api/reports/generate     — generate a new annual report (validated)
router.post('/generate', generateReportRules, validate, reportController.generateReport);

// GET  /api/reports              — list generated reports
router.get('/', reportController.listReports);

// GET  /api/reports/:id          — one report's summary
router.get('/:id', reportController.getReport);

// GET  /api/reports/:id/download — presigned download URL (?format=xml|pdf)
router.get('/:id/download', reportController.downloadReport);

// PATCH /api/reports/:id/submit  — mark as submitted to the BDO portal
router.patch('/:id/submit', reportController.submitReport);

module.exports = router;
