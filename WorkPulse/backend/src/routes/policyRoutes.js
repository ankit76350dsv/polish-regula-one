const express = require('express');
const { body } = require('express-validator');
const policyController = require('../controllers/policyController');
const { isAuthenticatedUser, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(isAuthenticatedUser);

// Any authenticated user can READ the policy (the Clock screen shows the norm).
router.get('/', policyController.getPolicy);

// Only admins may CHANGE the working-time policy.
router.put(
  '/',
  authorizeRoles('ROLE_ADMIN', 'ROLE_SUPER_ADMIN'),
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
