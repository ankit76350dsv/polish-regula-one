const express = require('express');
const { body } = require('express-validator');
const employeeProfileController = require('../controllers/employeeProfileController');
const {
  isAuthenticatedUser,
  authorizePermissions,
  authorizeCapability,
} = require('../middleware/authMiddleware');
const { CAPABILITIES } = require('../config/permissions');

const router = express.Router();
router.use(isAuthenticatedUser);
router.use(authorizePermissions());

// These flags say whether someone is pregnant, a young worker, or a parent of a
// child under 4 — because the law limits or bans their overtime and night work
// (Kodeks pracy art. 178 and art. 203). That makes them health and family data,
// which is special-category data under GDPR Article 9.
//
// So only HR and admins hold PROFILE_READ / PROFILE_WRITE. Auditors are excluded
// on purpose: an auditor checks that the LIMITS were respected, and the time
// records and violation reports already show that — they do not need to know who
// is pregnant (GDPR art. 5(1)(c), data minimisation).
router.get(
  '/:userId',
  authorizeCapability(CAPABILITIES.PROFILE_READ),
  employeeProfileController.getProfile
);

router.put(
  '/:userId',
  authorizeCapability(CAPABILITIES.PROFILE_WRITE),
  [
    body('isPregnant').optional().isBoolean(),
    body('isParentOfChildUnder4').optional().isBoolean(),
    body('isYoungWorker').optional().isBoolean(),
    body('consentToOvertime').optional().isBoolean(),
    body('consentToNightWork').optional().isBoolean(),
  ],
  employeeProfileController.upsertProfile
);

module.exports = router;
