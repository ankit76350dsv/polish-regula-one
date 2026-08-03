const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const {
  isAuthenticatedUser,
  authorizePermissions,
  authorizeCapability,
} = require('../middleware/authMiddleware');
const { CAPABILITIES } = require('../config/permissions');

const router = express.Router();
router.use(isAuthenticatedUser);
router.use(authorizePermissions());

// The dashboard shows other people's hours, overtime and violations, so it needs
// DASHBOARD_READ. Admins, HR and auditors have it; a normal employee does not —
// they see only their own timesheet.
router.get(
  '/overview',
  authorizeCapability(CAPABILITIES.DASHBOARD_READ),
  dashboardController.getOverview
);

router.get(
  '/monthly',
  authorizeCapability(CAPABILITIES.DASHBOARD_READ),
  dashboardController.getMonthly
);

module.exports = router;
