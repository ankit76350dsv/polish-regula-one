const express = require('express');
const wasteEntryController = require('../controllers/wasteEntryController');
const { isAuthenticatedUser } = require('../middleware/authMiddleware');
const { requireWasteSyncModule } = require('../middleware/moduleGuard');
const { validate } = require('../middleware/validate');
const { wasteEntryRules } = require('../validators/wasteEntryValidator');

const router = express.Router();

router.use(isAuthenticatedUser, requireWasteSyncModule);

// GET  /api/waste-entries          — current monthly figures for a company/year
// POST /api/waste-entries          — record/correct a month (creates a version)
router
  .route('/')
  .get(wasteEntryController.getMonthlyEntries)
  .post(wasteEntryRules, validate, wasteEntryController.recordMonthlyEntry);

// GET /api/waste-entries/history   — full version history of one month
router.get('/history', wasteEntryController.getEntryHistory);

module.exports = router;
