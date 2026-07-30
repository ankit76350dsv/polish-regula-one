const express = require('express');
const { body } = require('express-validator');
const policyController = require('../controllers/policyController');
const {
  isAuthenticatedUser,
  authorizePermissions,
  authorizeCapability,
} = require('../middleware/authMiddleware');
const { CAPABILITIES } = require('../config/permissions');

const router = express.Router();
router.use(isAuthenticatedUser);
router.use(authorizePermissions());

// Everyone may READ the policy: the Clock screen has to show people the daily and
// weekly norm that applies to them, so every role holds POLICY_READ.
router.get('/', authorizeCapability(CAPABILITIES.POLICY_READ), policyController.getPolicy);

// Only an ADMIN may CHANGE it — not even HR.
//
// The working-time system and settlement period are set in the workplace rules or
// the collective agreement (Kodeks pracy art. 150), so switching a tenant from a
// standard to an equivalent system is an employer-level decision that changes how
// every future hour is judged. That is why POLICY_WRITE sits with the admin alone.
router.put(
  '/',
  authorizeCapability(CAPABILITIES.POLICY_WRITE),
  [
    body('workingTimeSystem')
      .optional()
      .isIn(['STANDARD', 'EQUIVALENT', 'TASK_BASED', 'SHORTENED_WEEK', 'WEEKEND_WORK', 'FLEXIBLE', 'INDIVIDUAL']),
    body('standardDailyHours').optional().isFloat({ min: 1, max: 24 }),
    body('standardWeeklyHours').optional().isFloat({ min: 1, max: 168 }),
    body('settlementPeriodMonths').optional().isInt({ min: 1, max: 12 }),
  ],
  policyController.updatePolicy
);

module.exports = router;
