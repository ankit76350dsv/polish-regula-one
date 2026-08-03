const express = require('express');
const wasteEntryController = require('../controllers/wasteEntryController');
const {
  isAuthenticatedUser,
  authorizePermissions,
  authorizeCapability,
} = require('../middleware/authMiddleware');
const { requireWasteSyncModule } = require('../middleware/moduleGuard');
const { validate } = require('../middleware/validate');
const { wasteEntryRules } = require('../validators/wasteEntryValidator');
const { CAPABILITIES } = require('../config/permissions');

const router = express.Router();

// Same front door as every other WasteSync route file: logged in -> tenant owns
// the module -> this user was given WasteSync. The per-action check is on each
// route below. See routes/companyRoutes.js for the full table of who may do what.
router.use(isAuthenticatedUser, requireWasteSyncModule, authorizePermissions());

// GET  /api/waste-entries          — current monthly figures for a company/year
// POST /api/waste-entries          — record/correct a month (creates a version)
//
// Recording or correcting a month changes the numbers that end up in the annual
// report filed with the BDO register, so it needs WASTE_ENTRY_WRITE. Auditors do
// NOT have it: the person who checks the figures must not also produce them.
router
  .route('/')
  .get(
    authorizeCapability(CAPABILITIES.WASTE_ENTRY_READ),
    wasteEntryController.getMonthlyEntries
  )
  .post(
    authorizeCapability(CAPABILITIES.WASTE_ENTRY_WRITE),
    wasteEntryRules,
    validate,
    wasteEntryController.recordMonthlyEntry
  );

// GET /api/waste-entries/history   — full version history of one month
//
// History is the "what changed and when" view of the figures. It is plain reading,
// so everyone who may see the figures may see their history too.
router.get(
  '/history',
  authorizeCapability(CAPABILITIES.WASTE_ENTRY_READ),
  wasteEntryController.getEntryHistory
);

module.exports = router;
