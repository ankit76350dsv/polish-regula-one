const express = require('express');
const { body } = require('express-validator');
const employeeProfileController = require('../controllers/employeeProfileController');
const { isAuthenticatedUser, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(isAuthenticatedUser);

// Only HR/admins may see or change an employee's protected-status flags — these
// are sensitive (health/family) data, so they are never exposed to the employee
// list or self-service endpoints.
router.get(
  '/:userId',
  authorizeRoles('ROLE_ADMIN', 'ROLE_SUPER_ADMIN'),
  employeeProfileController.getProfile
);

router.put(
  '/:userId',
  authorizeRoles('ROLE_ADMIN', 'ROLE_SUPER_ADMIN'),
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
