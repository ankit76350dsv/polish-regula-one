const express = require('express');
const settlementController = require('../controllers/settlementController');
const { isAuthenticatedUser, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(isAuthenticatedUser);

// An employee may see their OWN settlement reconciliation.
router.get('/me', settlementController.getMySettlement);

// Only admins/HR may see the whole tenant's reconciliation report.
router.get(
  '/',
  authorizeRoles('ROLE_ADMIN', 'ROLE_SUPER_ADMIN'),
  settlementController.getTenantSettlement
);

module.exports = router;
