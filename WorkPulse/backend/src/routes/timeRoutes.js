const express = require('express');
const { body } = require('express-validator');
const timeController = require('../controllers/timeController');
const { isAuthenticatedUser, authorizeRoles } = require('../middleware/authMiddleware');
const { clockLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Everything here needs a logged-in user.
router.use(isAuthenticatedUser);

// ── Self-service (any authenticated employee) ────────────────────────────────

// Can I clock in right now? (reuses SafeWork's compliance decision)
router.get('/eligibility', timeController.getEligibility);

// My current status: eligibility + open shift + live totals.
router.get('/status', timeController.getStatus);

// Clock actions — rate limited so a script cannot hammer them.
router.post('/clock-in', clockLimiter, timeController.clockIn);
router.post('/clock-out', clockLimiter, timeController.clockOut);
router.post('/break/start', clockLimiter, timeController.startBreak);
router.post('/break/end', clockLimiter, timeController.endBreak);

// My own time history.
router.get('/my-entries', timeController.getMyEntries);

// ── Admin / HR (whole tenant) ────────────────────────────────────────────────

router.get(
  '/entries',
  authorizeRoles('ROLE_ADMIN', 'ROLE_SUPER_ADMIN'),
  timeController.listEntries
);

router.get(
  '/entries/:entryId',
  authorizeRoles('ROLE_ADMIN', 'ROLE_SUPER_ADMIN'),
  timeController.getEntryById
);

// Manual correction — a reason is mandatory (evidence integrity).
router.patch(
  '/entries/:entryId/correct',
  authorizeRoles('ROLE_ADMIN', 'ROLE_SUPER_ADMIN'),
  [body('correctionReason').isString().trim().notEmpty().withMessage('A correction reason is required')],
  timeController.correctEntry
);

// Approve or reject overtime.
router.patch(
  '/entries/:entryId/overtime',
  authorizeRoles('ROLE_ADMIN', 'ROLE_SUPER_ADMIN'),
  [body('decision').isIn(['APPROVE', 'REJECT'])],
  timeController.decideOvertime
);

module.exports = router;
