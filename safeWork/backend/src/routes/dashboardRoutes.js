const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { isAuthenticatedUser } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/dashboard/overview
// Returns all tenant-scoped dashboard data in a single response:
//   metrics, complianceHealth, employees, expiringDocuments,
//   recentDocuments, recentEmployees, recentAuditLogs.
// Tenant is derived from the authenticated user's JWT — no tenantId param needed.
router.get('/overview', isAuthenticatedUser, dashboardController.getDashboardOverview);

module.exports = router;
