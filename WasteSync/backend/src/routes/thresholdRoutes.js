const express = require('express');
const thresholdController = require('../controllers/thresholdController');
const {
  isAuthenticatedUser,
  authorizePermissions,
  authorizeCapability,
} = require('../middleware/authMiddleware');
const { requireWasteSyncModule } = require('../middleware/moduleGuard');
const { validate } = require('../middleware/validate');
const { thresholdRules } = require('../validators/thresholdValidator');
const { CAPABILITIES } = require('../config/permissions');

const router = express.Router();

// Same front door as every other WasteSync route file: logged in -> tenant owns
// the module -> this user was given WasteSync. The per-action check is on each
// route below. See routes/companyRoutes.js for the full table of who may do what.
router.use(isAuthenticatedUser, requireWasteSyncModule, authorizePermissions());

// ── Why writing a threshold is guarded harder than reading one ────────────────
//
// A threshold is the legal limit a report's totals are checked against. Somebody
// who could BOTH record the waste figures AND raise the limit could make any
// breach disappear, so those two powers are deliberately held by different people:
// only WASTESYNC_ADMIN gets THRESHOLD_WRITE.
//
// WHAT CHANGED AND WHY: this used to be authorizeRoles('ROLE_ADMIN',
// 'ROLE_SUPER_ADMIN'). That checked the PLATFORM role, which every tenant admin on
// RegulaOne holds — including admins of other apps who were never given WasteSync
// at all. So a KSeFFlow-only admin could raise this tenant's legal waste limits.
// The capability check below asks the narrower, correct question: "were YOU given
// the WasteSync admin role?".
//
// Reading the limits is open to every WasteSync role, because a report is
// impossible to understand without knowing what it was measured against.

// GET  /api/thresholds        — list the tenant's thresholds (optional ?year=)
// POST /api/thresholds        — create OR update the limit for a category+year
router
  .route('/')
  .get(
    authorizeCapability(CAPABILITIES.THRESHOLD_READ),
    thresholdController.listThresholds
  )
  .post(
    authorizeCapability(CAPABILITIES.THRESHOLD_WRITE),
    thresholdRules,
    validate,
    thresholdController.upsertThreshold
  );

// DELETE /api/thresholds/:id  — remove a threshold
//
// Removing a limit means the next report is no longer checked against it, which is
// just as powerful as raising it. Same admin-only capability.
router.delete(
  '/:id',
  authorizeCapability(CAPABILITIES.THRESHOLD_WRITE),
  thresholdController.deleteThreshold
);

module.exports = router;
