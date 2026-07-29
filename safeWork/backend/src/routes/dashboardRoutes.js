const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const {
  isAuthenticatedUser,
  authorizePermissions,
  authorizeCapability,
} = require('../middleware/authMiddleware');
const { CAPABILITIES } = require('../config/permissions');

const router = express.Router();

// Same front door as the admin routes: first "are you logged in?", then "may you
// use SafeWork at all?". The dashboard shows medical and BHP certificate status
// for real people, so it needs the same protection as the pages that list those
// records one by one.
router.use(isAuthenticatedUser);
router.use(authorizePermissions());

// GET /api/dashboard/overview
// Returns all tenant-scoped dashboard data in a single response:
//   metrics, complianceHealth, employees, expiringDocuments,
//   recentDocuments, recentEmployees, recentAuditLogs.
// Tenant is derived from the authenticated user's JWT — no tenantId param needed.
//
// Needs DASHBOARD_READ. All three main roles (admin, HR, auditor) have it, since
// the dashboard only shows counts and status — never a certificate file.
router.get(
  '/overview',
  authorizeCapability(CAPABILITIES.DASHBOARD_READ),
  dashboardController.getDashboardOverview
);

module.exports = router;
