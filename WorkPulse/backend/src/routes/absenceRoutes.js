const express = require('express');
const { body } = require('express-validator');
const absenceController = require('../controllers/absenceController');
const {
  isAuthenticatedUser,
  authorizePermissions,
  authorizeCapability,
} = require('../middleware/authMiddleware');
const { CAPABILITIES } = require('../config/permissions');

const router = express.Router();

// Every route: are you logged in, and may you use WorkPulse at all? Each route
// then names the ONE action it needs. See config/permissions.js for who gets what.
router.use(isAuthenticatedUser);
router.use(authorizePermissions());

// Self-service: create my own request, and list my own absences.
// Asking for leave is something every worker must be able to do — annual leave is
// a statutory right (Kodeks pracy art. 152) — so all four roles except the
// read-only auditor hold ABSENCE_SELF.
router.post(
  '/',
  authorizeCapability(CAPABILITIES.ABSENCE_SELF),
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

router.get('/mine', authorizeCapability(CAPABILITIES.ABSENCE_SELF), absenceController.getMyAbsences);

// Seeing everyone's absences is a management and audit view, so auditors can read
// it too (absence records are part of proving working-time compliance).
router.get('/', authorizeCapability(CAPABILITIES.ABSENCE_READ_ALL), absenceController.listAbsences);

// Deciding on a request changes an employee's legal entitlement, so it is a
// separate, stronger capability that the read-only auditor does not have.
router.patch(
  '/:id/decision',
  authorizeCapability(CAPABILITIES.ABSENCE_DECIDE),
  [body('status').isIn(['APPROVED', 'REJECTED', 'CANCELLED'])],
  absenceController.decideAbsence
);

module.exports = router;
