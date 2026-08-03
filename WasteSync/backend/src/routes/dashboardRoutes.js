const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const {
  isAuthenticatedUser,
  authorizePermissions,
  authorizeCapability,
} = require('../middleware/authMiddleware');
const { requireWasteSyncModule } = require('../middleware/moduleGuard');
const { CAPABILITIES } = require('../config/permissions');

const router = express.Router();

// Same front door as every other WasteSync route file: logged in -> tenant owns
// the module -> this user was given WasteSync. See routes/companyRoutes.js for the
// full table of who may do what.
router.use(isAuthenticatedUser, requireWasteSyncModule, authorizePermissions());

// GET /api/dashboard/overview — single aggregated dashboard payload.
//
// Needs DASHBOARD_READ. All three roles have it, because the dashboard only shows
// counts, totals and charts — never a legal limit change or a filing confirmation.
//
// ONE PART OF THIS PAYLOAD IS EXTRA-PROTECTED: the "recent activity" list is taken
// straight from the audit trail. Whoever may not open the Audit Logs page must not
// receive that data through the dashboard either, or the restriction would be
// pointless. So we tell the controller whether this caller holds AUDIT_READ, and it
// leaves the list out when they do not.
router.get(
  '/overview',
  authorizeCapability(CAPABILITIES.DASHBOARD_READ),
  dashboardController.getOverview
);

module.exports = router;
