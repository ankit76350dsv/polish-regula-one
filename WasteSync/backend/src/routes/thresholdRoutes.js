const express = require('express');
const thresholdController = require('../controllers/thresholdController');
const { isAuthenticatedUser, authorizeRoles } = require('../middleware/authMiddleware');
const { requireWasteSyncModule } = require('../middleware/moduleGuard');
const { validate } = require('../middleware/validate');
const { thresholdRules } = require('../validators/thresholdValidator');

const router = express.Router();

// Every route requires a logged-in user with WasteSync access.
router.use(isAuthenticatedUser, requireWasteSyncModule);

// Setting legal limits is a sensitive, compliance-relevant action, so only
// administrators may create, change, or delete thresholds. Any WasteSync user
// may READ them (so report pages can explain what the limits are).
const adminOnly = authorizeRoles('ROLE_ADMIN', 'ROLE_SUPER_ADMIN');

// GET  /api/thresholds        — list the tenant's thresholds (optional ?year=)
// POST /api/thresholds        — create OR update the limit for a category+year
router
  .route('/')
  .get(thresholdController.listThresholds)
  .post(adminOnly, thresholdRules, validate, thresholdController.upsertThreshold);

// DELETE /api/thresholds/:id  — remove a threshold
router.delete('/:id', adminOnly, thresholdController.deleteThreshold);

module.exports = router;
