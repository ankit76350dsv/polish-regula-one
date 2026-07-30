const express = require('express');
const { body } = require('express-validator');
const timeController = require('../controllers/timeController');
const {
  isAuthenticatedUser,
  authorizePermissions,
  authorizeCapability,
} = require('../middleware/authMiddleware');
const { CAPABILITIES } = require('../config/permissions');
const { clockLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// ── How access is decided in this file ───────────────────────────────────────
//
// THREE checks run, in this order:
//
//   1. isAuthenticatedUser    -> "are you logged in?"           (Cognito token)
//   2. authorizePermissions   -> "may you use WorkPulse at all?" (front door)
//   3. authorizeCapability    -> "may you do THIS ONE THING?"    (per route)
//
// Checks 1 and 2 use router.use(), so they cover every route below and a new
// endpoint can never be left unprotected by accident.
//
// Check 3 is written on each route because it differs per route. It names an
// ACTION, never a job title. config/permissions.js says which job title is given
// which actions:
//
//   ACTION            | ADMIN | HR_ADMIN | AUDITOR | EMPLOYEE
//   ------------------|-------|----------|---------|----------
//   CLOCK_SELF        |  yes  |   yes    |   no    |   yes
//   TIME_SELF_READ    |  yes  |   yes    |   no    |   yes
//   TIME_READ_ALL     |  yes  |   yes    |   yes   |   no
//   TIME_CORRECT      |  yes  |   yes    |   no    |   no
//   OVERTIME_DECIDE   |  yes  |   yes    |   no    |   no
//
// To change what a job title may do, edit that table — not these routes.
router.use(isAuthenticatedUser);
router.use(authorizePermissions());

// ── Self-service: a person's OWN working time ────────────────────────────────
// These endpoints read the employee from the session, never from the request, so
// they can only ever touch the caller's own records.

// Can I clock in right now? (reuses SafeWork's compliance decision)
router.get(
  '/eligibility',
  authorizeCapability(CAPABILITIES.TIME_SELF_READ),
  timeController.getEligibility
);

// My current status: eligibility + open shift + live totals.
router.get(
  '/status',
  authorizeCapability(CAPABILITIES.TIME_SELF_READ),
  timeController.getStatus
);

// Clock actions — rate limited so a script cannot hammer them.
// These CREATE the working-time record that Polish law requires the employer to
// keep (Kodeks pracy art. 149 §1), which is why they need their own capability
// instead of being open to "any logged-in user".
router.post(
  '/clock-in',
  authorizeCapability(CAPABILITIES.CLOCK_SELF),
  clockLimiter,
  timeController.clockIn
);
router.post(
  '/clock-out',
  authorizeCapability(CAPABILITIES.CLOCK_SELF),
  clockLimiter,
  timeController.clockOut
);
router.post(
  '/break/start',
  authorizeCapability(CAPABILITIES.CLOCK_SELF),
  clockLimiter,
  timeController.startBreak
);
router.post(
  '/break/end',
  authorizeCapability(CAPABILITIES.CLOCK_SELF),
  clockLimiter,
  timeController.endBreak
);

// My own time history.
router.get(
  '/my-entries',
  authorizeCapability(CAPABILITIES.TIME_SELF_READ),
  timeController.getMyEntries
);

// ── Whole tenant: management and audit views ─────────────────────────────────

// Every employee's time records. Auditors have this too, because reading the
// records is exactly how compliance with the working-time rules is proven.
router.get(
  '/entries',
  authorizeCapability(CAPABILITIES.TIME_READ_ALL),
  timeController.listEntries
);

router.get(
  '/entries/:entryId',
  authorizeCapability(CAPABILITIES.TIME_READ_ALL),
  timeController.getEntryById
);

// Manual correction — a reason is mandatory (evidence integrity).
//
// A working-time record is legal evidence in front of a labour inspector, so
// changing one is a much stronger act than reading it. Auditors are excluded on
// purpose: an auditor who could edit records could create the result they then
// sign off. The written reason is kept in the audit trail forever.
router.patch(
  '/entries/:entryId/correct',
  authorizeCapability(CAPABILITIES.TIME_CORRECT),
  [body('correctionReason').isString().trim().notEmpty().withMessage('A correction reason is required')],
  timeController.correctEntry
);

// Approve or reject overtime.
//
// Overtime is capped by law (art. 151 §3 — 150 hours a year per employee unless
// the workplace rules say otherwise; art. 131 — the average week must stay within
// 48 hours including overtime), so approving it commits the employer legally.
// Only admins and HR may do it.
router.patch(
  '/entries/:entryId/overtime',
  authorizeCapability(CAPABILITIES.OVERTIME_DECIDE),
  [body('decision').isIn(['APPROVE', 'REJECT'])],
  timeController.decideOvertime
);

module.exports = router;
