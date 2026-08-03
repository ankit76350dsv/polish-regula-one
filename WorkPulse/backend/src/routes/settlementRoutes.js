const express = require('express');
const settlementController = require('../controllers/settlementController');
const {
  isAuthenticatedUser,
  authorizePermissions,
  authorizeCapability,
} = require('../middleware/authMiddleware');
const { CAPABILITIES } = require('../config/permissions');

const router = express.Router();
router.use(isAuthenticatedUser);
router.use(authorizePermissions());

// A person may always see their OWN settlement-period balance — how many hours
// they owe or are owed at the end of the period. That is their own data.
router.get('/me', authorizeCapability(CAPABILITIES.SETTLEMENT_SELF_READ), settlementController.getMySettlement);

// The whole-tenant reconciliation report shows every employee's balance, so it
// needs the wider SETTLEMENT_READ_ALL. Auditors have it too, since balancing the
// settlement period is part of proving working-time compliance.
router.get(
  '/',
  authorizeCapability(CAPABILITIES.SETTLEMENT_READ_ALL),
  settlementController.getTenantSettlement
);

module.exports = router;
