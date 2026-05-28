const express = require('express');
const { body } = require('express-validator');
const employeeController = require('../controllers/employeeController');
const { isAuthenticatedUser, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(isAuthenticatedUser);

// GET /api/admin/users/:tenantId
// Returns all RegulaOne users for the tenant merged with their EmployeeProfile data.
// Users with no profile are flagged as profileMissing: true.
router.get(
  '/users/:tenantId',
  authorizeRoles('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'ROLE_USER', 'COMPLIANCE_OFFICER'),
  employeeController.getEmployees
);

// PUT /api/admin/employees/:employeeId
// Upserts the compliance profile for a RegulaOne user identified by employeeId.
// Acts as create on first call; subsequent calls update the existing profile.
// Identity fields (name, email) must NOT be sent — they are read from RegulaOne.
router.put(
  '/employees/:employeeId',
  authorizeRoles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_USER'),
  [
    body('department').optional().isString(),
    body('position').optional().isString(),
    body('riskLevel').optional().isIn(['LOW', 'MEDIUM', 'HIGH']),
    body('contractType').optional().isIn(['UOP', 'UZ', 'UOD', 'B2B', 'OTHER']),
  ],
  employeeController.upsertEmployeeProfile
);

// PATCH /api/admin/employees/:employeeId/compliance
// Updates only compliance-specific fields (medical cert status, BHP, blocking).
// Separate from the profile upsert so compliance officers can update status
// without needing full profile edit permissions.
router.patch(
  '/employees/:employeeId/compliance',
  authorizeRoles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_USER'),
  employeeController.updateEmployeeCompliance
);

module.exports = router;
