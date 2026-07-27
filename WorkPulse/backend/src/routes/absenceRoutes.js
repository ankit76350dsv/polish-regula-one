const express = require('express');
const { body } = require('express-validator');
const absenceController = require('../controllers/absenceController');
const { isAuthenticatedUser, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(isAuthenticatedUser);

// Self-service: create my own request, and list my own absences.
router.post(
  '/',
  [
    body('type').isIn([
      'ANNUAL_LEAVE',
      'ON_DEMAND_LEAVE',
      'SICK_LEAVE',
      'UNPAID_LEAVE',
      'MATERNITY_LEAVE',
      'CHILDCARE_LEAVE',
      'SPECIAL_LEAVE',
      'PUBLIC_HOLIDAY',
      'OTHER',
    ]),
    body('startDate').isISO8601(),
    body('endDate').isISO8601(),
  ],
  absenceController.createAbsence
);

router.get('/mine', absenceController.getMyAbsences);

// Admin / HR: list all absences and decide on them.
router.get('/', authorizeRoles('ROLE_ADMIN', 'ROLE_SUPER_ADMIN'), absenceController.listAbsences);

router.patch(
  '/:id/decision',
  authorizeRoles('ROLE_ADMIN', 'ROLE_SUPER_ADMIN'),
  [body('status').isIn(['APPROVED', 'REJECTED', 'CANCELLED'])],
  absenceController.decideAbsence
);

module.exports = router;
